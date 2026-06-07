// Initialize the SQLite database with the schema. Idempotent — safe to run
// multiple times because schema.sql uses CREATE TABLE IF NOT EXISTS.
const db = require('./connection');
const schema = require('fs').readFileSync(require('path').join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);
const tblCount = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table'").get().c;
console.log('✓ Database initialized at', db.path);
console.log('✓ Schema applied with', tblCount, 'tables');
