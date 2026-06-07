const express = require('express');
const { body, param } = require('express-validator');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, AppError, validate } = require('../middleware/errorHandler');
const { paginate, buildPageResponse, receiptNo, isValidDate } = require('../utils/helpers');
const audit = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

// =========================
// FEE STRUCTURES
// =========================
router.get('/fee-structures', asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM fee_structures ORDER BY batch_year DESC, semester').all();
  res.json({ success: true, data: rows });
}));

router.post('/fee-structures', authorize('admin'), [
  body('name').isString().isLength({ min: 1 })
], validate, asyncHandler(async (req, res) => {
  const { name, program, batchYear, semester, tuitionFee = 0, labFee = 0, libraryFee = 0,
          hostelFee = 0, examFee = 0, miscFee = 0, dueDate } = req.body;
  const total = +tuitionFee + +labFee + +libraryFee + +hostelFee + +examFee + +miscFee;
  const info = db.prepare(`
    INSERT INTO fee_structures (name, program, batch_year, semester, tuition_fee, lab_fee, library_fee, hostel_fee, exam_fee, misc_fee, total, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, program || null, batchYear || null, semester || null, tuitionFee, labFee, libraryFee, hostelFee, examFee, miscFee, total, dueDate || null);
  audit.log({ userId: req.user.id, action: 'CREATE_FEE_STRUCTURE', resource: 'fee_structure:' + info.lastInsertRowid, ip: req.ip });
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM fee_structures WHERE id = ?').get(info.lastInsertRowid) });
}));

router.delete('/fee-structures/:id', authorize('admin'), [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const info = db.prepare('DELETE FROM fee_structures WHERE id = ?').run(req.params.id);
  if (!info.changes) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: { deleted: true } });
}));

// =========================
// FEE PAYMENTS
// =========================
router.get('/payments', authorize('admin', 'accountant'), asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req);
  const { studentId, status, from, to } = req.query;
  const filters = [];
  const params = [];
  if (studentId) { filters.push('p.student_id = ?'); params.push(studentId); }
  if (status) { filters.push('p.status = ?'); params.push(status); }
  if (from) { filters.push('date(p.paid_at) >= ?'); params.push(from); }
  if (to) { filters.push('date(p.paid_at) <= ?'); params.push(to); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM fee_payments p ${where}`).get(...params).c;
  const rows = db.prepare(`
    SELECT p.*, s.roll_no, s.first_name, s.last_name, u.email
    FROM fee_payments p
    JOIN students s ON s.id = p.student_id
    JOIN users u ON u.id = s.user_id
    ${where} ORDER BY p.paid_at DESC LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);
  res.json({ success: true, ...buildPageResponse(rows, total, page, pageSize) });
}));

router.post('/payments', authorize('admin', 'accountant'), [
  body('studentId').isInt(),
  body('amount').isFloat({ min: 0 }),
  body('paymentMode').isIn(['cash', 'card', 'upi', 'bank', 'online', 'cheque'])
], validate, asyncHandler(async (req, res) => {
  const { studentId, amount, paymentMode, transactionId, structureId, remarks } = req.body;
  const s = db.prepare('SELECT id FROM students WHERE id = ?').get(studentId);
  if (!s) throw new AppError('Student not found', 404, 'NOT_FOUND');

  const receipt = receiptNo();
  const info = db.prepare(`
    INSERT INTO fee_payments (student_id, structure_id, amount, payment_mode, transaction_id, receipt_no, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(studentId, structureId || null, amount, paymentMode, transactionId || null, receipt, remarks || null);

  audit.log({ userId: req.user.id, action: 'FEE_PAYMENT', resource: 'student:' + studentId, details: { amount, paymentMode, receipt }, ip: req.ip });
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM fee_payments WHERE id = ?').get(info.lastInsertRowid) });
}));

router.get('/payments/receipt/:id', [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const p = db.prepare(`
    SELECT p.*, s.roll_no, s.first_name, s.last_name, s.batch_year, s.program, u.email
    FROM fee_payments p
    JOIN students s ON s.id = p.student_id
    JOIN users u ON u.id = s.user_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) throw new AppError('Receipt not found', 404, 'NOT_FOUND');
  if (req.user.role === 'student') {
    const s = db.prepare('SELECT user_id FROM students WHERE id = ?').get(p.student_id);
    if (s.user_id !== req.user.id) throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
  res.json({ success: true, data: p });
}));

router.get('/my/payments', asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new AppError('Students only', 403, 'FORBIDDEN');
  const s = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
  if (!s) return res.json({ success: true, data: [] });
  const rows = db.prepare('SELECT * FROM fee_payments WHERE student_id = ? ORDER BY paid_at DESC').all(s.id);
  res.json({ success: true, data: rows });
}));

// student fee summary
router.get('/fees/student/:studentId/summary', [param('studentId').isInt()], validate, asyncHandler(async (req, res) => {
  if (req.user.role === 'student') {
    const s = db.prepare('SELECT user_id FROM students WHERE id = ?').get(req.params.studentId);
    if (!s || s.user_id !== req.user.id) throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
  const paid = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM fee_payments WHERE student_id = ? AND status='success'`).get(req.params.studentId).total;
  const byStructure = db.prepare(`
    SELECT structure_id, COALESCE(SUM(amount),0) AS total FROM fee_payments
    WHERE student_id = ? AND status='success' GROUP BY structure_id
  `).all(req.params.studentId);
  res.json({ success: true, data: { totalPaid: paid, byStructure } });
}));

module.exports = router;
