const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
	SEARCH_DIR: "../assets",
	TARGET_FILENAME: "HighContrast.svg",
	// New: Define how the output file should be named
	OUTPUT_FILENAME: "HighContrast_currentColor.svg",
	OLD_COLOR: /#212121/gi,
	NEW_COLOR: "currentColor",
};

class SvgColorSwapper {
	constructor() {
		this.processedCount = 0;
		this.skippedCount = 0;
	}

	findFiles(dir, fileList = []) {
		const items = fs.readdirSync(dir);

		for (const item of items) {
			const fullPath = path.join(dir, item);
			const stat = fs.statSync(fullPath);

			if (stat.isDirectory()) {
				this.findFiles(fullPath, fileList);
			} else if (item === CONFIG.TARGET_FILENAME) {
				fileList.push(fullPath);
			}
		}
		return fileList;
	}

	process() {
		const searchPath = path.resolve(__dirname, CONFIG.SEARCH_DIR);

		if (!fs.existsSync(searchPath)) {
			console.error(`Directory not found: ${searchPath}`);
			return;
		}

		console.log(`Searching for ${CONFIG.TARGET_FILENAME} files...`);
		const files = this.findFiles(searchPath);

		if (files.length === 0) {
			console.log("No matching files found.");
			return;
		}

		console.log(
			`Found ${files.length} files. Creating copies with updates...\n`,
		);

		files.forEach((filePath) => {
			const dirName = path.dirname(filePath);
			const newFilePath = path.join(dirName, CONFIG.OUTPUT_FILENAME); // Create new path
			const relativePath = path.relative(searchPath, filePath);

			const content = fs.readFileSync(filePath, "utf8");

			if (CONFIG.OLD_COLOR.test(content)) {
				const updatedContent = content.replace(
					CONFIG.OLD_COLOR,
					CONFIG.NEW_COLOR,
				);

				// Write to newFilePath instead of filePath
				fs.writeFileSync(newFilePath, updatedContent, "utf8");

				console.log(`✓ Created: ${path.relative(searchPath, newFilePath)}`);
				this.processedCount++;
			} else {
				console.log(`- Skipped (Color not found in): ${relativePath}`);
				this.skippedCount++;
			}
		});

		this.printSummary();
	}

	printSummary() {
		console.log("\n" + "=".repeat(40));
		console.log("PROCESS COMPLETE");
		console.log("=".repeat(40));
		console.log(
			`Total source files: ${this.processedCount + this.skippedCount}`,
		);
		console.log(`New files created:  ${this.processedCount}`);
		console.log(`Files ignored:      ${this.skippedCount}`);
		console.log("=".repeat(40));
	}
}

const swapper = new SvgColorSwapper();
swapper.process();
