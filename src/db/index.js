const fs = require("fs");
const path = require("path");

let _db = null;
let _dbPath = null;

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

function saveDb() {
  if (!_db || !_dbPath) return;
  const data = _db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(_dbPath, buffer);
}

function closeDb() {
  if (_db) {
    saveDb();
    _db.close();
    _db = null;
    _dbPath = null;
  }
}

function resetDb() {
  _db = null;
  _dbPath = null;
}

module.exports = { getDb, saveDb, closeDb, resetDb };