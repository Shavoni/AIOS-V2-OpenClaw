const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");

let _db = null;
let _dbPath = null;
let _autoSaveInterval = null;
let _dirty = false;
let _saving = false;

async function getDb(dbPath) {
  if (_db) return _db;

  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs();

  _dbPath = dbPath;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  _db.run("PRAGMA journal_mode = WAL");
  _db.run("PRAGMA foreign_keys = ON");

  return _db;
}

/**
 * Async save — writes DB to disk without blocking the event loop.
 * Prevents concurrent writes with a lock flag.
 */
async function saveDb() {
  if (!_db || !_dbPath || _saving) return;
  _saving = true;
  try {
    const data = _db.export();
    const buffer = Buffer.from(data);
    await fsPromises.writeFile(_dbPath, buffer);
    _dirty = false;
  } finally {
    _saving = false;
  }
}

/**
 * Synchronous save — only used during shutdown for final flush.
 */
function saveDbSync() {
  if (!_db || !_dbPath) return;
  const data = _db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(_dbPath, buffer);
  _dirty = false;
}

/**
 * Mark DB as dirty (called by services after writes).
 * The auto-save interval will flush to disk periodically.
 */
function markDirty() {
  _dirty = true;
}

/**
 * Start auto-saving at the given interval (ms).
 * Only writes to disk if the DB has been modified since last save.
 */
function startAutoSave(intervalMs = 30000) {
  stopAutoSave();
  _autoSaveInterval = setInterval(async () => {
    if (_dirty && _db && _dbPath) {
      try {
        await saveDb();
      } catch (err) {
        console.error("Auto-save failed:", err.message);
      }
    }
  }, intervalMs);

  // Don't let the timer keep the process alive
  if (_autoSaveInterval.unref) _autoSaveInterval.unref();
}

function stopAutoSave() {
  if (_autoSaveInterval) {
    clearInterval(_autoSaveInterval);
    _autoSaveInterval = null;
  }
}

function closeDb() {
  if (_db) {
    stopAutoSave();
    saveDbSync(); // Final synchronous flush on shutdown
    _db.close();
    _db = null;
    _dbPath = null;
    _dirty = false;
  }
}

function resetDb() {
  _db = null;
  _dbPath = null;
  _dirty = false;
}

module.exports = { getDb, saveDb, saveDbSync, closeDb, resetDb, markDirty, startAutoSave, stopAutoSave };
