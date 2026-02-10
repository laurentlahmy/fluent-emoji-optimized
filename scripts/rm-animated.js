const fs = require("fs/promises");
const path = require("path");

const TARGET_FILES = ["Animated.png", "Animated_256.webp"];
// Points to the "assets" folder relative to this script's location
const ASSETS_DIR = path.join(__dirname, "../assets");

async function deleteFiles(dir) {
	try {
		console.log(`Searching for targets in: ${dir}...`);

		// Check if the directory actually exists first
		await fs.access(dir);

		const entries = await fs.readdir(dir, {
			withFileTypes: true,
			recursive: true,
		});
		let deleteCount = 0;

		for (const entry of entries) {
			if (entry.isFile() && TARGET_FILES.includes(entry.name)) {
				// Handle path compatibility for different Node versions
				const parentDir = entry.parentPath || entry.path;
				const fullPath = path.join(parentDir, entry.name);

				await fs.unlink(fullPath);
				console.log(`[REMOVED] ${entry.name} -> ${fullPath}`);
				deleteCount++;
			}
		}

		console.log(`--- Cleanup complete. Files removed: ${deleteCount} ---`);
	} catch (err) {
		if (err.code === "ENOENT") {
			console.error(`Error: The directory "${dir}" does not exist.`);
		} else {
			console.error("Error during cleanup:", err.message);
		}
	}
}

deleteFiles(ASSETS_DIR);