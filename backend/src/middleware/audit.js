const db = require('../db/connection');

const log = ({ userId, action, resource, details, ip }) => {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, resource, details, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId || null, action, resource || null, details ? JSON.stringify(details) : null, ip || null);
  } catch (e) {
    console.error('Audit log failed', e);
  }
};

module.exports = { log };
