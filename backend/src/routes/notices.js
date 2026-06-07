const express = require('express');
const { body, param } = require('express-validator');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, AppError, validate } = require('../middleware/errorHandler');
const { paginate, buildPageResponse, isValidDate } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate);

router.get('/notices', asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req);
  const { audience, priority } = req.query;
  const filters = ["(expires_at IS NULL OR date(expires_at) >= date('now'))"];
  const params = [];
  if (audience) { filters.push('audience = ?'); params.push(audience); }
  if (priority) { filters.push('priority = ?'); params.push(priority); }
  const where = 'WHERE ' + filters.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM notices ${where}`).get(...params).c;
  const rows = db.prepare(`
    SELECT n.*, u.email AS author_email FROM notices n LEFT JOIN users u ON u.id = n.posted_by
    ${where} ORDER BY
      CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
      created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);
  res.json({ success: true, ...buildPageResponse(rows, total, page, pageSize) });
}));

router.post('/notices', authorize('admin'), [
  body('title').isString().isLength({ min: 1 }),
  body('body').isString().isLength({ min: 1 }),
  body('audience').optional().isIn(['all', 'student', 'faculty', 'librarian', 'accountant']),
  body('priority').optional().isIn(['urgent', 'high', 'normal', 'low']),
  body('expiresAt').optional().isISO8601()
], validate, asyncHandler(async (req, res) => {
  const { title, body: txt, audience = 'all', priority = 'normal', expiresAt } = req.body;
  const info = db.prepare(`
    INSERT INTO notices (title, body, audience, priority, expires_at, posted_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, txt, audience, priority, expiresAt || null, req.user.id);
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM notices WHERE id = ?').get(info.lastInsertRowid) });
}));

router.delete('/notices/:id', authorize('admin'), [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const info = db.prepare('DELETE FROM notices WHERE id = ?').run(req.params.id);
  if (!info.changes) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: { deleted: true } });
}));

module.exports = router;
