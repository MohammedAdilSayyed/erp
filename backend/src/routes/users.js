const express = require('express');
const { body, param } = require('express-validator');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, AppError, validate } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticate);

// =========================
// USERS (admin only)
// =========================
router.get('/users', authorize('admin'), asyncHandler(async (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.email, u.role, u.is_active, u.must_change_password, u.last_login_at, u.created_at
    FROM users u ORDER BY u.created_at DESC
  `).all();
  res.json({ success: true, data: rows });
}));

router.put('/users/:id/status', authorize('admin'), [
  param('id').isInt(),
  body('isActive').isBoolean()
], validate, asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) throw new AppError('User not found', 404, 'NOT_FOUND');
  db.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(isActive ? 1 : 0, req.params.id);
  res.json({ success: true, data: db.prepare('SELECT id, email, role, is_active FROM users WHERE id = ?').get(req.params.id) });
}));

module.exports = router;
