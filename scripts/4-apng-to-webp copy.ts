import { globSync } from 'glob';
import { spawn } from 'node:child_process';
import { resolve, dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import pMap from 'p-map';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  SOURCE_DIR: 'assets',
  OUTPUT_DIR: 'packages/anim/assets',
  TARGET_FILENAME: 'Animated.png',
  NEW_FILENAME: 'Animated_256.webp', // Updated requirement
  CONCURRENCY: 10,
};

class EmojiConverter {
  private root = resolve(__dirname, '../');

  private findFiles(): string[] {
    const searchPattern = join(this.root, CONFIG.SOURCE_DIR, '**', CONFIG.TARGET_FILENAME);
    const normalizedPattern = searchPattern.replace(/\\/g, '/');

    console.log(`[Discovery] Searching for files matching: ${normalizedPattern}`);
    const files = globSync(normalizedPattern);
    console.log(`[Discovery] Found ${files.length} matching files.\n`);

    return files;
  }

  private async convertFile(input: string, output: string): Promise<void> {
    return new Promise((res, rej) => {
      // ffmpeg command to convert apng/png to webp
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', input,
        '-lossless', '0',
        '-compression_level', '6',
        '-quality', '100',
        '-loop', '0',
        output
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          res();
        } else {
          rej(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on('error', (err) => rej(err));
    });
  }

  async run() {
    const sourceBase = resolve(this.root, CONFIG.SOURCE_DIR);
    const outputBase = resolve(this.root, CONFIG.OUTPUT_DIR);

    console.log('--- Starting Process ---');
    console.log(`Source: ${sourceBase}`);
    console.log(`Output: ${outputBase}\n`);

    const files = this.findFiles();

    if (files.length === 0) {
      console.log('⚠️ No files found to process. Check your SOURCE_DIR path.');
      return;
    }

    await pMap(files, async (filePath, index) => {
      const logPrefix = `[${index + 1}/${files.length}]`;

      // Calculate paths
      const relPath = relative(sourceBase, filePath);
      const relDir = dirname(relPath);

      // Construct the new path: packages/anim/assets/{subfolder}/Animated_256.webp
      const outputFilePath = join(outputBase, relDir, CONFIG.NEW_FILENAME);
      const outputDir = dirname(outputFilePath);

      // Verbose: Directory creation
      if (!fs.existsSync(outputDir)) {
        console.log(`${logPrefix} Creating directory: ${outputDir}`);
        fs.mkdirSync(outputDir, { recursive: true });
      }

      console.log(`${logPrefix} Converting: ${relPath} -> ${CONFIG.NEW_FILENAME}`);

      try {
        const start = Date.now();
        await this.convertFile(filePath, outputFilePath);
        const duration = ((Date.now() - start) / 1000).toFixed(2);

        console.log(`${logPrefix} ✓ Success (${duration}s)`);
      } catch (err) {
        console.error(`${logPrefix} ✗ Failed to convert ${relPath}`);
        if (err instanceof Error) console.error(`    Error: ${err.message}`);
      }
    }, { concurrency: CONFIG.CONCURRENCY });

    console.log('\n--- Process Complete ---');
    console.log(`All files have been processed and saved to ${CONFIG.OUTPUT_DIR}`);
  }
}

// Global error handling for the async run
new EmojiConverter().run().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});