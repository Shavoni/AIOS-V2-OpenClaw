/**
 * Shared test database setup — eliminates duplicate initSqlJs + initSchema boilerplate.
 */

const initSqlJs = require("sql.js");
const { initSchema } = require("../../src/db/schema");

async function createTestDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  initSchema(db);
  return db;
}

module.exports = { createTestDb };
