const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const dbPath = path.resolve(__dirname, '../../../data/erp.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(dbPath)) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const tmp = new DatabaseSync(dbPath);
  tmp.exec('PRAGMA journal_mode = WAL;');
  tmp.exec('PRAGMA foreign_keys = ON;');
  tmp.exec(schema);
  tmp.close();
}

const raw = new DatabaseSync(dbPath);
raw.exec('PRAGMA journal_mode = WAL;');
raw.exec('PRAGMA foreign_keys = ON;');

// ---------------------------------------------------------------------------
// better-sqlite3-style adapter on top of node:sqlite. node:sqlite's statement
// already has run/get/all that accept a single object/array of positional
// params, so the only translation needed is normalizing the calling shape.
//
//   better-sqlite3:  stmt.run(a, b, c)  stmt.get(a, b, c)  stmt.all(a, b, c)
//   node:sqlite:      stmt.run([a,b,c]) stmt.get([a,b,c]) stmt.all([a,b,c])
//
// We accept both shapes on the adapter side for convenience.
// ---------------------------------------------------------------------------
const normalizeArgs = (params) => {
  if (params === undefined || params === null) return [];
  if (!Array.isArray(params)) return [params];
  if (params.length === 1 && params[0] !== undefined && params[0] !== null
      && typeof params[0] === 'object' && !Array.isArray(params[0])
      && !(params[0] instanceof Date) && !(params[0] instanceof Buffer)) {
    // Some better-sqlite3 callers pass a single object that maps to @named
    // params. Our SQL uses ? placeholders so we can't safely remap.
    throw new Error('Object parameters are not supported; pass positional args.');
  }
  return params;
};

const prepare = (sql) => {
  const stmt = raw.prepare(sql);
  return {
    run(...params) {
      return stmt.run(...normalizeArgs(params));
    },
    get(...params) {
      const row = stmt.get(...normalizeArgs(params));
      return row && Object.keys(row).length ? row : null;
    },
    all(...params) {
      return stmt.all(...normalizeArgs(params));
    }
  };
};

const exec = (sql) => raw.exec(sql);

const transaction = (fn) => {
  return (...args) => {
    raw.exec('BEGIN');
    try {
      const r = fn(...args);
      raw.exec('COMMIT');
      return r;
    } catch (e) {
      try { raw.exec('ROLLBACK'); } catch (_) {}
      throw e;
    }
  };
};

module.exports = { prepare, exec, transaction, raw, path: dbPath };
