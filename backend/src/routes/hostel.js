const express = require('express');
const { body, param } = require('express-validator');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, AppError, validate } = require('../middleware/errorHandler');
const audit = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

// HOSTELS
router.get('/hostels', asyncHandler(async (req, res) => {
  const rows = db.prepare(`
    SELECT h.*, (SELECT COUNT(*) FROM rooms WHERE hostel_id = h.id) AS room_count,
           (SELECT COALESCE(SUM(capacity),0) FROM rooms WHERE hostel_id = h.id) AS total_capacity,
           (SELECT COALESCE(SUM(occupied),0) FROM rooms WHERE hostel_id = h.id) AS total_occupied
    FROM hostels h ORDER BY h.name
  `).all();
  res.json({ success: true, data: rows });
}));

router.post('/hostels', authorize('admin'), [
  body('name').isString().isLength({ min: 1 }),
  body('type').isString().isLength({ min: 1 }),
  body('warden').optional().isString(),
  body('totalRooms').optional().isInt({ min: 0 })
], validate, asyncHandler(async (req, res) => {
  const { name, type, warden, totalRooms = 0 } = req.body;
  const info = db.prepare(`INSERT INTO hostels (name, type, warden, total_rooms) VALUES (?, ?, ?, ?)`)
    .run(name, type, warden || null, totalRooms);
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM hostels WHERE id = ?').get(info.lastInsertRowid) });
}));

// ROOMS
router.get('/hostels/:hostelId/rooms', [param('hostelId').isInt()], validate, asyncHandler(async (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, (r.capacity - r.occupied) AS available
    FROM rooms r WHERE r.hostel_id = ? ORDER BY r.room_no
  `).all(req.params.hostelId);
  res.json({ success: true, data: rows });
}));

router.post('/hostels/:hostelId/rooms', authorize('admin'), [
  param('hostelId').isInt(),
  body('roomNo').isString().isLength({ min: 1 }),
  body('capacity').optional().isInt({ min: 1 })
], validate, asyncHandler(async (req, res) => {
  const { roomNo, capacity = 2 } = req.body;
  try {
    const info = db.prepare('INSERT INTO rooms (hostel_id, room_no, capacity) VALUES (?, ?, ?)')
      .run(req.params.hostelId, roomNo, capacity);
    res.status(201).json({ success: true, data: db.prepare('SELECT * FROM rooms WHERE id = ?').get(info.lastInsertRowid) });
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new AppError('Room already exists', 409, 'CONFLICT');
    throw e;
  }
}));

// ALLOCATIONS
router.get('/allocations', authorize('admin'), asyncHandler(async (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, s.roll_no, s.first_name, s.last_name, r.room_no, h.name AS hostel_name, h.type AS hostel_type
    FROM hostel_allocations a
    JOIN students s ON s.id = a.student_id
    JOIN rooms r ON r.id = a.room_id
    JOIN hostels h ON h.id = r.hostel_id
    ORDER BY a.allocated_at DESC
  `).all();
  res.json({ success: true, data: rows });
}));

router.post('/allocations', authorize('admin'), [
  body('studentId').isInt(),
  body('roomId').isInt()
], validate, asyncHandler(async (req, res) => {
  const { studentId, roomId } = req.body;
  const r = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!r) throw new AppError('Room not found', 404, 'NOT_FOUND');
  if (r.occupied >= r.capacity) throw new AppError('Room is full', 409, 'FULL');
  const existing = db.prepare(`SELECT id FROM hostel_allocations WHERE student_id = ? AND status='active'`).get(studentId);
  if (existing) throw new AppError('Student already allocated', 409, 'CONFLICT');

  const txn = db.transaction(() => {
    const info = db.prepare(`INSERT INTO hostel_allocations (student_id, room_id) VALUES (?, ?)`).run(studentId, roomId);
    db.prepare('UPDATE rooms SET occupied = occupied + 1 WHERE id = ?').run(roomId);
    return info.lastInsertRowid;
  });
  const id = txn();
  audit.log({ userId: req.user.id, action: 'ALLOCATE_HOSTEL', resource: 'student:' + studentId, details: { roomId }, ip: req.ip });
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM hostel_allocations WHERE id = ?').get(id) });
}));

router.post('/allocations/:id/vacate', authorize('admin'), [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const a = db.prepare('SELECT * FROM hostel_allocations WHERE id = ?').get(req.params.id);
  if (!a) throw new AppError('Allocation not found', 404, 'NOT_FOUND');
  if (a.status === 'vacated') throw new AppError('Already vacated', 409, 'CONFLICT');
  const txn = db.transaction(() => {
    db.prepare(`UPDATE hostel_allocations SET status='vacated', vacated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    db.prepare('UPDATE rooms SET occupied = occupied - 1 WHERE id = ?').run(a.room_id);
  });
  txn();
  res.json({ success: true, data: db.prepare('SELECT * FROM hostel_allocations WHERE id = ?').get(req.params.id) });
}));

module.exports = router;
