const fs = require("fs/promises");
const path = require("path");

const DELETE_TARGET = "HighContrast.svg";
const RENAME_SOURCE = "HighContrast_currentColor.svg";
const ASSETS_DIR = path.join(__dirname, "../assets");

async function processIcons(dir) {
	try {
		console.log(`Processing icons in: ${dir}...`);
		await fs.access(dir);

		const entries = await fs.readdir(dir, {
			withFileTypes: true,
			recursive: true,
		});

		// 1. Filter for our specific files
		const filesToDelete = [];
		const filesToRename = [];

		for (const entry of entries) {
			if (!entry.isFile()) continue;

			const parentDir = entry.parentPath || entry.path;
			const fullPath = path.join(parentDir, entry.name);

			if (entry.name === DELETE_TARGET) {
				filesToDelete.push(fullPath);
			} else if (entry.name === RENAME_SOURCE) {
				filesToRename.push({
					oldPath: fullPath,
					newPath: path.join(parentDir, DELETE_TARGET),
				});
			}
		}

		// 2. Execution Phase: Delete first
		for (const filePath of filesToDelete) {
			await fs.unlink(filePath);
			console.log(`[DELETED] ${filePath}`);
		}

		// 3. Execution Phase: Rename second
		for (const file of filesToRename) {
			await fs.rename(file.oldPath, file.newPath);
			console.log(`[RENAMED] ${RENAME_SOURCE} -> ${DELETE_TARGET}`);
		}

		console.log(
			`\nTask Complete: ${filesToDelete.length} deleted, ${filesToRename.length} renamed.`,
		);
	} catch (err) {
		console.error("Operation failed:", err.message);
	}
}

processIcons(ASSETS_DIR);