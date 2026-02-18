const fs = require("fs/promises");
const path = require("path");

async function readMarkdown(filePath) {
  return fs.readFile(filePath, "utf-8");
}

async function writeMarkdown(filePath, content) {
  await ensureDir(path.dirname(filePath));
  return fs.writeFile(filePath, content, "utf-8");
}

async function appendToFile(filePath, content) {
  await ensureDir(path.dirname(filePath));
  return fs.appendFile(filePath, content, "utf-8");
}

async function listDirectory(dirPath, extension = ".md") {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(extension)) {
        const fullPath = path.join(dirPath, entry.name);
        const stat = await fs.stat(fullPath);
        files.push({
          filename: entry.name,
          path: fullPath,
          sizeBytes: stat.size,
          lastModified: stat.mtime.toISOString(),
        });
      }
    }
    return files.sort(
      (a, b) => new Date(b.lastModified) - new Date(a.lastModified)
    );
  } catch {
    return [];
  }
}

async function listSubdirectories(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJSON(filePath) {
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content);
}

async function writeJSON(filePath, data) {
  await ensureDir(path.dirname(filePath));
  return fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

module.exports = {
  readMarkdown,
  writeMarkdown,
  appendToFile,
  listDirectory,
  listSubdirectories,
  fileExists,
  ensureDir,
  readJSON,
  writeJSON,
};
