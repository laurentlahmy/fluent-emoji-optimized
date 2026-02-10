const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const CONFIG = {
  DOWNLOADS_DIR: '../assets',
//   RESOLUTIONS: [256],
  RESOLUTIONS: [80, 88, 96, 108, 112, 120, 128, 136, 144, 256],
  CONCURRENT_CONVERSIONS: 3,
  WEBP_QUALITY: 100 // Quality setting for WebP (0-100)
};

class ImageConverter {
  constructor() {
    this.processedCount = 0;
    this.errorCount = 0;
    this.totalImages = 0;
    this.errors = [];
  }

  // Find all 3D.png files recursively
  find3DImages(dir, fileList = []) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.find3DImages(fullPath, fileList);
      } else if (item === '3D.png') {
        fileList.push(fullPath);
      }
    }

    return fileList;
  }

  // Convert single image to WebP at multiple resolutions
  async convertImage(imagePath) {
    const dir = path.dirname(imagePath);
    const conversions = [];

    console.log(`\nProcessing: ${path.relative(CONFIG.DOWNLOADS_DIR, imagePath)}`);

    for (const size of CONFIG.RESOLUTIONS) {
      const outputPath = path.join(dir, `3D_${size}.webp`);
      
      conversions.push(
        sharp(imagePath)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
          })
          .webp({ 
            quality: CONFIG.WEBP_QUALITY,
            alphaQuality: 100,
            lossless: false
          })
          .toFile(outputPath)
          .then(() => {
            console.log(`  ✓ ${size}x${size}`);
            return { success: true, size };
          })
          .catch((error) => {
            console.error(`  ✗ ${size}x${size}: ${error.message}`);
            return { success: false, size, error: error.message };
          })
      );
    }

    const results = await Promise.all(conversions);
    const failures = results.filter(r => !r.success);

    if (failures.length > 0) {
      this.errors.push({
        image: imagePath,
        failures: failures
      });
      this.errorCount++;
    } else {
      this.processedCount++;
    }
  }

  // Process images in batches
  async convertAll() {
    const downloadsDir = path.resolve(__dirname, CONFIG.DOWNLOADS_DIR);

    if (!fs.existsSync(downloadsDir)) {
      console.error(`Downloads directory not found: ${downloadsDir}`);
      return;
    }

    console.log('Searching for 3D.png files...');
    const images = this.find3DImages(downloadsDir);
    this.totalImages = images.length;

    if (images.length === 0) {
      console.log('No 3D.png files found.');
      return;
    }

    console.log(`\nFound ${images.length} images to process`);
    console.log(`Generating ${CONFIG.RESOLUTIONS.length} WebP versions for each`);
    console.log(`Resolutions: ${CONFIG.RESOLUTIONS.join(', ')}px`);
    console.log(`Quality: ${CONFIG.WEBP_QUALITY}`);
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
    console.log(`Total WebP files created: ${this.processedCount * CONFIG.RESOLUTIONS.length}`);
    console.log('='.repeat(50));

    if (this.errors.length > 0) {
      console.log('\nErrors occurred in the following images:');
      for (const error of this.errors) {
        console.log(`\n${error.image}`);
        for (const failure of error.failures) {
          console.log(`  - ${failure.size}x${failure.size}: ${failure.error}`);
        }
      }
      
      // Save errors to file
      fs.writeFileSync(
        './conversion-errors.json',
        JSON.stringify(this.errors, null, 2)
      );
      console.log('\nErrors saved to: ./conversion-errors.json');
    } else {
      console.log('\n🎉 All conversions completed successfully!');
    }
  }
}

// Check if sharp is installed
try {
  require.resolve('sharp');
} catch (e) {
  console.error('ERROR: sharp module is not installed.');
  console.error('Please install it by running: npm install sharp');
  process.exit(1);
}

// Main execution
const converter = new ImageConverter();
converter.convertAll();