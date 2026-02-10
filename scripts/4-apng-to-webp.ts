const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const CONFIG = {
  ASSETS_DIR: '../assets',
  CONCURRENT_CONVERSIONS: 3,
  FFMPEG_OPTIONS: {
    lossless: '0',
    compression_level: '6',
    quality: '100',
    loop: '0'
  }
};

class AnimatedImageConverter {
  constructor() {
    this.processedCount = 0;
    this.errorCount = 0;
    this.totalImages = 0;
    this.errors = [];
  }

  // Find all Animated.png files recursively
  findAnimatedImages(dir, fileList = []) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.findAnimatedImages(fullPath, fileList);
      } else if (item === 'Animated.png') {
        fileList.push(fullPath);
      }
    }

    return fileList;
  }

  // Convert single animated PNG to WebP
  async convertImage(imagePath) {
    const dir = path.dirname(imagePath);
    const outputPath = path.join(dir, 'Animated_256.webp');

    console.log(`\nProcessing: ${path.relative(CONFIG.ASSETS_DIR, imagePath)}`);

    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', imagePath,
        '-lossless', CONFIG.FFMPEG_OPTIONS.lossless,
        '-compression_level', CONFIG.FFMPEG_OPTIONS.compression_level,
        '-quality', CONFIG.FFMPEG_OPTIONS.quality,
        '-loop', CONFIG.FFMPEG_OPTIONS.loop,
        outputPath
      ]);

      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`  ✓ Converted successfully`);
          this.processedCount++;
          resolve({ success: true });
        } else {
          console.error(`  ✗ Conversion failed (exit code ${code})`);
          this.errors.push({
            image: imagePath,
            error: errorOutput,
            exitCode: code
          });
          this.errorCount++;
          resolve({ success: false });
        }
      });

      ffmpeg.on('error', (error) => {
        console.error(`  ✗ Failed to spawn ffmpeg: ${error.message}`);
        this.errors.push({
          image: imagePath,
          error: error.message
        });
        this.errorCount++;
        resolve({ success: false });
      });
    });
  }

  // Process images in batches
  async convertAll() {
    const assetsDir = path.resolve(__dirname, CONFIG.ASSETS_DIR);

    if (!fs.existsSync(assetsDir)) {
      console.error(`Assets directory not found: ${assetsDir}`);
      return;
    }

    console.log('Searching for Animated.png files...');
    const images = this.findAnimatedImages(assetsDir);
    this.totalImages = images.length;

    if (images.length === 0) {
      console.log('No Animated.png files found.');
      return;
    }

    console.log(`\nFound ${images.length} animated images to process`);
    console.log(`FFmpeg options:`);
    console.log(`  - Lossless: ${CONFIG.FFMPEG_OPTIONS.lossless}`);
    console.log(`  - Compression level: ${CONFIG.FFMPEG_OPTIONS.compression_level}`);
    console.log(`  - Quality: ${CONFIG.FFMPEG_OPTIONS.quality}`);
    console.log(`  - Loop: ${CONFIG.FFMPEG_OPTIONS.loop}`);
    console.log(`Concurrent conversions: ${CONFIG.CONCURRENT_CONVERSIONS}\n`);

    // Process in batches
    for (let i = 0; i < images.length; i += CONFIG.CONCURRENT_CONVERSIONS) {
      const batch = images.slice(i, i + CONFIG.CONCURRENT_CONVERSIONS);
      await Promise.all(batch.map(img => this.convertImage(img)));

      const progress = Math.min(i + CONFIG.CONCURRENT_CONVERSIONS, images.length);
      console.log(`\n--- Progress: ${progress}/${images.length} images processed ---`);
    }

    this.printSummary();
  }

  // Print summary
  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('CONVERSION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total images found: ${this.totalImages}`);
    console.log(`✓ Successfully processed: ${this.processedCount}`);
    console.log(`✗ Errors: ${this.errorCount}`);
    console.log('='.repeat(50));

    if (this.errors.length > 0) {
      console.log('\nErrors occurred in the following images:');
      for (const error of this.errors) {
        console.log(`\n${error.image}`);
        console.log(`  Error: ${error.error || `Exit code ${error.exitCode}`}`);
      }

      // Save errors to file
      fs.writeFileSync(
        './animated-conversion-errors.json',
        JSON.stringify(this.errors, null, 2)
      );
      console.log('\nErrors saved to: ./animated-conversion-errors.json');
    } else {
      console.log('\n🎉 All conversions completed successfully!');
    }
  }
}

// Check if ffmpeg is available
function checkFFmpeg() {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);

    ffmpeg.on('error', () => {
      console.error('ERROR: ffmpeg is not installed or not in PATH.');
      console.error('Please install ffmpeg: https://ffmpeg.org/download.html');
      resolve(false);
    });

    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

// Main execution
(async () => {
  const hasFFmpeg = await checkFFmpeg();

  if (!hasFFmpeg) {
    process.exit(1);
  }

  const converter = new AnimatedImageConverter();
  await converter.convertAll();
})();
