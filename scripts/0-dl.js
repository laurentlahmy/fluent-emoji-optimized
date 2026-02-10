const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// Configuration
const CONFIG = {
	MAX_RETRIES: 3,
	RETRY_DELAY: 2000, // ms
	CONCURRENT_DOWNLOADS: 5,
	OUTPUT_DIR: "../assets",
	FAILED_LOG: "./failed-downloads.json",
};

// Load your emoji data
const emojiData = require("../inputs/xsalazar-fluent-emoji/metadata.json"); // Your JSON file

class EmojiDownloader {
	constructor() {
		this.failedDownloads = [];
		this.successCount = 0;
		this.failCount = 0;
	}

	// Create directory structure
	ensureDir(dirPath) {
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true });
		}
	}

	// Download a single file with retry logic
	async downloadFile(url, outputPath, retries = CONFIG.MAX_RETRIES) {
		return new Promise((resolve, reject) => {
			const parsedUrl = new URL(url);
			const protocol = parsedUrl.protocol === "https:" ? https : http;

			const request = protocol.get(url, (response) => {
				// Handle redirects
				if (response.statusCode === 301 || response.statusCode === 302) {
					return this.downloadFile(
						response.headers.location,
						outputPath,
						retries,
					)
						.then(resolve)
						.catch(reject);
				}

				if (response.statusCode !== 200) {
					reject(
						new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`),
					);
					return;
				}

				const fileStream = fs.createWriteStream(outputPath);
				response.pipe(fileStream);

				fileStream.on("finish", () => {
					fileStream.close();
					resolve();
				});

				fileStream.on("error", (err) => {
					fs.unlink(outputPath, () => {}); // Delete partial file
					reject(err);
				});
			});

			request.on("error", (err) => {
				reject(err);
			});

			request.setTimeout(30000, () => {
				request.destroy();
				reject(new Error("Request timeout"));
			});
		}).catch(async (error) => {
			if (retries > 0) {
				console.log(
					`  Retrying... (${CONFIG.MAX_RETRIES - retries + 1}/${CONFIG.MAX_RETRIES})`,
				);
				await this.sleep(CONFIG.RETRY_DELAY);
				return this.downloadFile(url, outputPath, retries - 1);
			}
			throw error;
		});
	}

	// Helper: sleep function
	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// Get file extension from URL
	getExtension(url) {
		const match = url.match(/\.(png|svg|jpg|jpeg|gif)(\?|$)/i);
		return match ? match[1] : "png";
	}

	// Download all styles for a single emoji
	async downloadEmoji(emojiName, emojiData) {
		const cldrName = emojiData.cldr;
		console.log(`\nDownloading: ${cldrName}`);

		const emojiDir = path.join(CONFIG.OUTPUT_DIR, cldrName);
		this.ensureDir(emojiDir);

		const downloads = [];

		// Handle regular styles (non-skintone emojis)
		if (emojiData.styles) {
			for (const [styleName, url] of Object.entries(emojiData.styles)) {
				const ext = this.getExtension(url);
				const filename = `${styleName}.${ext}`;
				const outputPath = path.join(emojiDir, filename);

				downloads.push(
					this.downloadFile(url, outputPath)
						.then(() => {
							console.log(`  ✓ ${styleName}`);
							this.successCount++;
						})
						.catch((error) => {
							console.error(`  ✗ ${styleName}: ${error.message}`);
							this.failedDownloads.push({
								emoji: emojiName,
								cldr: cldrName,
								style: styleName,
								url: url,
								error: error.message,
							});
							this.failCount++;
						}),
				);
			}
		}

		// Handle skintone-based emojis
		if (emojiData.skintones) {
			for (const [skintoneName, styles] of Object.entries(
				emojiData.skintones,
			)) {
				// Create skintone subfolder
				const skintoneDir = path.join(emojiDir, skintoneName);
				this.ensureDir(skintoneDir);

				for (const [styleName, url] of Object.entries(styles)) {
					const ext = this.getExtension(url);
					const filename = `${styleName}.${ext}`;
					const outputPath = path.join(skintoneDir, filename);

					downloads.push(
						this.downloadFile(url, outputPath)
							.then(() => {
								console.log(`  ✓ ${skintoneName}/${styleName}`);
								this.successCount++;
							})
							.catch((error) => {
								console.error(
									`  ✗ ${skintoneName}/${styleName}: ${error.message}`,
								);
								this.failedDownloads.push({
									emoji: emojiName,
									cldr: cldrName,
									skintone: skintoneName,
									style: styleName,
									url: url,
									error: error.message,
								});
								this.failCount++;
							}),
					);
				}
			}
		}

		await Promise.all(downloads);
	}

	// Process emojis in batches
	async downloadAll() {
		const emojis = Object.entries(emojiData);
		const total = emojis.length;

		console.log(`Starting download of ${total} emojis...`);
		console.log(`Output directory: ${CONFIG.OUTPUT_DIR}`);
		console.log(`Concurrent downloads: ${CONFIG.CONCURRENT_DOWNLOADS}\n`);

		this.ensureDir(CONFIG.OUTPUT_DIR);

		// Process in batches for concurrency control
		for (let i = 0; i < emojis.length; i += CONFIG.CONCURRENT_DOWNLOADS) {
			const batch = emojis.slice(i, i + CONFIG.CONCURRENT_DOWNLOADS);
			await Promise.all(
				batch.map(([name, data]) => this.downloadEmoji(name, data)),
			);

			const progress = Math.min(i + CONFIG.CONCURRENT_DOWNLOADS, total);
			console.log(`\nProgress: ${progress}/${total} emojis processed`);
		}

		this.printSummary();
	}

	// Print summary and save failed downloads
	printSummary() {
		console.log("\n" + "=".repeat(50));
		console.log("DOWNLOAD SUMMARY");
		console.log("=".repeat(50));
		console.log(`✓ Successful: ${this.successCount}`);
		console.log(`✗ Failed: ${this.failCount}`);
		console.log("=".repeat(50));

		if (this.failedDownloads.length > 0) {
			fs.writeFileSync(
				CONFIG.FAILED_LOG,
				JSON.stringify(this.failedDownloads, null, 2),
			);
			console.log(`\nFailed downloads logged to: ${CONFIG.FAILED_LOG}`);
			console.log(
				"You can retry failed downloads by running the script again.",
			);
		} else {
			console.log("\n🎉 All downloads completed successfully!");
		}
	}

	// Retry only failed downloads
	async retryFailed() {
		if (!fs.existsSync(CONFIG.FAILED_LOG)) {
			console.log("No failed downloads log found.");
			return;
		}

		const failed = JSON.parse(fs.readFileSync(CONFIG.FAILED_LOG, "utf8"));
		console.log(`Retrying ${failed.length} failed downloads...\n`);

		this.failedDownloads = [];
		this.successCount = 0;
		this.failCount = 0;

		const grouped = {};
		for (const item of failed) {
			if (!grouped[item.emoji]) {
				grouped[item.emoji] = {
					cldr: item.cldr,
					styles: {},
					skintones: {},
				};
			}

			if (item.skintone) {
				// Skintone-based emoji
				if (!grouped[item.emoji].skintones[item.skintone]) {
					grouped[item.emoji].skintones[item.skintone] = {};
				}
				grouped[item.emoji].skintones[item.skintone][item.style] = item.url;
			} else {
				// Regular emoji
				grouped[item.emoji].styles[item.style] = item.url;
			}
		}

		for (const [emojiName, data] of Object.entries(grouped)) {
			await this.downloadEmoji(emojiName, data);
		}

		this.printSummary();
	}
}

// Main execution
const downloader = new EmojiDownloader();

// Check command line arguments
const args = process.argv.slice(2);

if (args.includes("--retry")) {
	downloader.retryFailed();
} else {
	downloader.downloadAll();
}
