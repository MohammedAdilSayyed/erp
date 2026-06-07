const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const db = require('../db/connection');
const { signToken, authenticate } = require('../middleware/auth');
const { asyncHandler, AppError, validate } = require('../middleware/errorHandler');
const { isValidEmail } = require('../utils/helpers');
const audit = require('../middleware/audit');

const router = express.Router();

const validateLogin = [
  body('email').isEmail().withMessage('Valid email required').bail(),
  body('password').isString().isLength({ min: 1 }).withMessage('Password required')
];

router.post('/login', validateLogin, validate, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !user.is_active) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);

  let profile = null;
  if (user.role === 'student') {
    profile = db.prepare('SELECT id, roll_no, first_name, last_name, current_semester FROM students WHERE user_id = ?').get(user.id);
  } else if (user.role === 'faculty') {
    profile = db.prepare('SELECT id, employee_id, first_name, last_name, designation FROM faculty WHERE user_id = ?').get(user.id);
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  audit.log({ userId: user.id, action: 'LOGIN', resource: 'users', details: { email: user.email }, ip: req.ip });

  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, role: user.role, mustChangePassword: !!user.must_change_password },
      profile
    }
  });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const u = db.prepare('SELECT id, email, role, is_active, must_change_password, last_login_at, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!u) throw new AppError('User not found', 404, 'NOT_FOUND');
  let profile = null;
  if (u.role === 'student') profile = db.prepare('SELECT * FROM students WHERE user_id = ?').get(u.id);
  else if (u.role === 'faculty') profile = db.prepare('SELECT * FROM faculty WHERE user_id = ?').get(u.id);
  res.json({ success: true, data: { user: u, profile } });
}));

router.post('/change-password', authenticate, [
  body('currentPassword').isString().isLength({ min: 1 }),
  body('newPassword').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], validate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) throw new AppError('Current password is incorrect', 401, 'BAD_CREDENTIALS');
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?").run(hash, user.id);
  audit.log({ userId: user.id, action: 'CHANGE_PASSWORD', resource: 'users', ip: req.ip });
  res.json({ success: true, data: { message: 'Password updated' } });
}));

module.exports = router;
