const fs = require("fs/promises");
const path = require("path");

// Configuration
const TO_DELETE = ["3D.png"];
const RENAME_SOURCE = "HighContrast_currentColor.svg";
const RENAME_TARGET = "HighContrast.svg";

const ASSETS_DIR = path.join(__dirname, "../assets");

async function cleanAndRename() {
	try {
		console.log(`🚀 Starting cleanup in: ${ASSETS_DIR}`);

		// Check if assets folder exists
		await fs.access(ASSETS_DIR);

		// Get all files recursively
		const entries = await fs.readdir(ASSETS_DIR, {
			withFileTypes: true,
			recursive: true,
		});

		const deleteList = [];
		const renameList = [];

		// Categorize files
		for (const entry of entries) {
			if (!entry.isFile()) continue;

			const parentDir = entry.parentPath || entry.path;
			const fullPath = path.join(parentDir, entry.name);

			if (TO_DELETE.includes(entry.name)) {
				deleteList.push(fullPath);
			} else if (entry.name === RENAME_SOURCE) {
				renameList.push({
					oldPath: fullPath,
					newPath: path.join(parentDir, RENAME_TARGET),
				});
			}
		}

		// Step 1: Deletions
		for (const filePath of deleteList) {
			await fs.unlink(filePath);
			console.log(`🗑️  Deleted: ${path.relative(ASSETS_DIR, filePath)}`);
		}

		// Step 2: Renames
		for (const { oldPath, newPath } of renameList) {
			await fs.rename(oldPath, newPath);
			console.log(
				`🔄 Renamed: ${path.relative(ASSETS_DIR, oldPath)} -> ${RENAME_TARGET}`,
			);
		}

		console.log(
			`\n✅ Done! Removed ${deleteList.length} files and updated ${renameList.length} icons.`,
		);
	} catch (err) {
		if (err.code === "ENOENT") {
			console.error('❌ Error: The "assets" directory was not found.');
		} else {
			console.error("❌ Error:", err.message);
		}
	}
}

cleanAndRename();
