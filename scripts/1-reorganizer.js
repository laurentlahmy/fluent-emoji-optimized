const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  DOWNLOADS_DIR: '../assets',
  METADATA_FILE: '../inputs/xsalazar-fluent-emoji/metadata.json'
};

class EmojiReorganizer {
  constructor() {
    this.movedCount = 0;
    this.skippedCount = 0;
    this.errorCount = 0;
  }

  // Load metadata to check which emojis are skintone-based
  loadMetadata() {
    const metadataPath = path.resolve(__dirname, CONFIG.METADATA_FILE);
    return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  }

  // Check if a directory exists
  directoryExists(dirPath) {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  }

  // Move files to Default subfolder
  moveToDefault(emojiDir, cldrName) {
    try {
      const defaultDir = path.join(emojiDir, 'Default');
      
      // Get all items in the emoji directory
      const items = fs.readdirSync(emojiDir);
      
      // Filter out directories (these are skintone folders)
      const files = items.filter(item => {
        const itemPath = path.join(emojiDir, item);
        return fs.statSync(itemPath).isFile();
      });

      if (files.length === 0) {
        console.log(`  ⊘ No files to move (already organized or skintone-based)`);
        this.skippedCount++;
        return;
      }

      // Create Default directory
      if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
      }

      // Move each file to Default subfolder
      for (const file of files) {
        const sourcePath = path.join(emojiDir, file);
        const destPath = path.join(defaultDir, file);
        
        fs.renameSync(sourcePath, destPath);
      }

      console.log(`  ✓ Moved ${files.length} file(s) to Default/`);
      this.movedCount++;

    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      this.errorCount++;
    }
  }

  // Process all emojis
  reorganize() {
    console.log('Loading metadata...');
    const metadata = this.loadMetadata();
    
    const downloadsDir = path.resolve(__dirname, CONFIG.DOWNLOADS_DIR);
    
    if (!this.directoryExists(downloadsDir)) {
      console.error(`Downloads directory not found: ${downloadsDir}`);
      return;
    }

    console.log(`\nReorganizing emojis in: ${downloadsDir}\n`);

    // Iterate through metadata to find non-skintone emojis
    for (const [emojiName, emojiData] of Object.entries(metadata)) {
      const cldrName = emojiData.cldr;
      const emojiDir = path.join(downloadsDir, cldrName);

      // Skip if directory doesn't exist
      if (!this.directoryExists(emojiDir)) {
        continue;
      }

      // Only process if it has 'styles' (non-skintone based)
      if (emojiData.styles && !emojiData.skintones) {
        console.log(`Processing: ${cldrName}`);
        this.moveToDefault(emojiDir, cldrName);
      }
    }

    this.printSummary();
  }

  // Print summary
  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('REORGANIZATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✓ Moved to Default/: ${this.movedCount} emojis`);
    console.log(`⊘ Skipped: ${this.skippedCount} emojis`);
    console.log(`✗ Errors: ${this.errorCount} emojis`);
    console.log('='.repeat(50));
  }
}

// Main execution
const reorganizer = new EmojiReorganizer();
reorganizer.reorganize();
 