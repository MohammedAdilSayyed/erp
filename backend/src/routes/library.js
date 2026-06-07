const express = require('express');
const { body, param } = require('express-validator');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, AppError, validate } = require('../middleware/errorHandler');
const { paginate, buildPageResponse, isValidDate, todayISO } = require('../utils/helpers');
const audit = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

// =========================
// BOOKS
// =========================
router.get('/books', asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req);
  const { q, category } = req.query;
  const filters = [];
  const params = [];
  if (q) {
    filters.push('(title LIKE ? OR author LIKE ? OR isbn LIKE ?)');
    const like = '%' + q + '%';
    params.push(like, like, like);
  }
  if (category) { filters.push('category = ?'); params.push(category); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM books ${where}`).get(...params).c;
  const rows = db.prepare(`SELECT * FROM books ${where} ORDER BY title LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
  res.json({ success: true, ...buildPageResponse(rows, total, page, pageSize) });
}));

router.post('/books', authorize('admin', 'librarian'), [
  body('title').isString().isLength({ min: 1 }),
  body('author').isString().isLength({ min: 1 })
], validate, asyncHandler(async (req, res) => {
  const { isbn, title, author, publisher, edition, category, totalCopies = 1, shelfLocation } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO books (isbn, title, author, publisher, edition, category, total_copies, available_copies, shelf_location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(isbn || null, title, author, publisher || null, edition || null, category || null, totalCopies, totalCopies, shelfLocation || null);
    audit.log({ userId: req.user.id, action: 'CREATE_BOOK', resource: 'book:' + info.lastInsertRowid, ip: req.ip });
    res.status(201).json({ success: true, data: db.prepare('SELECT * FROM books WHERE id = ?').get(info.lastInsertRowid) });
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new AppError('ISBN already exists', 409, 'CONFLICT');
    throw e;
  }
}));

router.put('/books/:id', authorize('admin', 'librarian'), [
  param('id').isInt(),
  body('title').optional().isString().isLength({ min: 1 }),
  body('author').optional().isString().isLength({ min: 1 }),
  body('publisher').optional().isString(),
  body('edition').optional().isString(),
  body('category').optional().isString(),
  body('totalCopies').optional().isInt({ min: 0 }),
  body('shelfLocation').optional().isString()
], validate, asyncHandler(async (req, res) => {
  const b = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!b) throw new AppError('Book not found', 404, 'NOT_FOUND');
  const x = req.body;
  db.prepare(`
    UPDATE books SET
      title = COALESCE(?, title), author = COALESCE(?, author), publisher = COALESCE(?, publisher),
      edition = COALESCE(?, edition), category = COALESCE(?, category),
      total_copies = COALESCE(?, total_copies), shelf_location = COALESCE(?, shelf_location)
    WHERE id = ?
  `).run(x.title ?? null, x.author ?? null, x.publisher ?? null, x.edition ?? null, x.category ?? null,
    x.totalCopies ?? null, x.shelfLocation ?? null, req.params.id);
  res.json({ success: true, data: db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id) });
}));

router.delete('/books/:id', authorize('admin', 'librarian'), [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const info = db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  if (!info.changes) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: { deleted: true } });
}));

// =========================
// BOOK ISSUES
// =========================
router.get('/issues', asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req);
  const { userId, status, bookId } = req.query;
  const filters = [];
  const params = [];
  if (userId) { filters.push('bi.user_id = ?'); params.push(userId); }
  if (status) { filters.push('bi.status = ?'); params.push(status); }
  if (bookId) { filters.push('bi.book_id = ?'); params.push(bookId); }
  if (req.user.role === 'student') { filters.push('bi.user_id = ?'); params.push(req.user.id); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM book_issues bi ${where}`).get(...params).c;
  const rows = db.prepare(`
    SELECT bi.*, b.title, b.author, b.isbn, u.email, u.role
    FROM book_issues bi
    JOIN books b ON b.id = bi.book_id
    JOIN users u ON u.id = bi.user_id
    ${where} ORDER BY bi.issued_at DESC LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);
  res.json({ success: true, ...buildPageResponse(rows, total, page, pageSize) });
}));

router.post('/issues', authorize('admin', 'librarian'), [
  body('bookId').isInt(),
  body('userId').isInt(),
  body('days').optional().isInt({ min: 1, max: 60 })
], validate, asyncHandler(async (req, res) => {
  const { bookId, userId, days = 14 } = req.body;
  const b = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!b) throw new AppError('Book not found', 404, 'NOT_FOUND');
  if (b.available_copies < 1) throw new AppError('No copies available', 409, 'NO_COPY');
  const u = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(userId);
  if (!u) throw new AppError('User not found or inactive', 404, 'NOT_FOUND');

  const due = new Date(); due.setDate(due.getDate() + days);
  const txn = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO book_issues (book_id, user_id, due_date) VALUES (?, ?, ?)
    `).run(bookId, userId, due.toISOString().slice(0, 10));
    db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(bookId);
    return info.lastInsertRowid;
  });
  const id = txn();
  audit.log({ userId: req.user.id, action: 'ISSUE_BOOK', resource: 'book:' + bookId, details: { to: userId, days }, ip: req.ip });
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM book_issues WHERE id = ?').get(id) });
}));

router.post('/issues/:id/return', authorize('admin', 'librarian'), [
  param('id').isInt(),
  body('returnedAt').optional().isISO8601()
], validate, asyncHandler(async (req, res) => {
  const issue = db.prepare('SELECT * FROM book_issues WHERE id = ?').get(req.params.id);
  if (!issue) throw new AppError('Issue not found', 404, 'NOT_FOUND');
  if (issue.status === 'returned') throw new AppError('Already returned', 409, 'CONFLICT');

  const returned = req.body.returnedAt || todayISO();
  let fine = 0;
  if (returned > issue.due_date) {
    const overdueDays = Math.ceil((new Date(returned) - new Date(issue.due_date)) / 86400000);
    fine = overdueDays * 5; // 5 per day
  }

  const txn = db.transaction(() => {
    db.prepare(`UPDATE book_issues SET returned_at = ?, status = 'returned', fine_amount = ? WHERE id = ?`)
      .run(returned, fine, req.params.id);
    db.prepare('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?').run(issue.book_id);
  });
  txn();
  audit.log({ userId: req.user.id, action: 'RETURN_BOOK', resource: 'issue:' + req.params.id, details: { fine }, ip: req.ip });
  res.json({ success: true, data: db.prepare('SELECT * FROM book_issues WHERE id = ?').get(req.params.id) });
}));

module.exports = router;
