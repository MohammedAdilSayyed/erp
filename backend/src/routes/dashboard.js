const express = require('express');
const { query } = require('express-validator');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, AppError, validate } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

router.get('/stats', asyncHandler(async (req, res) => {
  const totalStudents = db.prepare(`SELECT COUNT(*) AS c FROM students WHERE status='active'`).get().c;
  const totalFaculty = db.prepare(`SELECT COUNT(*) AS c FROM faculty WHERE status='active'`).get().c;
  const totalCourses = db.prepare(`SELECT COUNT(*) AS c FROM courses`).get().c;
  const totalOfferings = db.prepare(`SELECT COUNT(*) AS c FROM course_offerings WHERE is_active=1`).get().c;
  const totalEnrollments = db.prepare(`SELECT COUNT(*) AS c FROM enrollments WHERE status='enrolled'`).get().c;
  const totalBooks = db.prepare(`SELECT COUNT(*) AS c FROM books`).get().c;
  const totalBookCopies = db.prepare(`SELECT COALESCE(SUM(total_copies),0) AS c FROM books`).get().c;
  const issuedBooks = db.prepare(`SELECT COUNT(*) AS c FROM book_issues WHERE status='issued'`).get().c;
  const totalRevenue = db.prepare(`SELECT COALESCE(SUM(amount),0) AS c FROM fee_payments WHERE status='success'`).get().c;
  const recentPayments = db.prepare(`SELECT COALESCE(SUM(amount),0) AS c FROM fee_payments WHERE status='success' AND date(paid_at) >= date('now','-30 day')`).get().c;
  const hostels = db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(r.capacity),0) AS capacity, COALESCE(SUM(r.occupied),0) AS occupied
    FROM hostels h LEFT JOIN rooms r ON r.hostel_id = h.id`).get();

  const today = new Date().toISOString().slice(0, 10);
  const todayAttendance = db.prepare(`
    SELECT status, COUNT(*) AS c FROM attendance WHERE session_date = ? GROUP BY status
  `).all(today);
  const attMap = { present: 0, absent: 0, late: 0, excused: 0 };
  todayAttendance.forEach(r => { attMap[r.status] = r.c; });

  const studentsByDept = db.prepare(`
    SELECT COALESCE(d.name, 'Unassigned') AS name, COUNT(s.id) AS c
    FROM students s LEFT JOIN departments d ON d.id = s.department_id
    WHERE s.status='active' GROUP BY d.id ORDER BY c DESC
  `).all();

  const studentsByBatch = db.prepare(`
    SELECT batch_year AS name, COUNT(*) AS c FROM students WHERE status='active' GROUP BY batch_year ORDER BY batch_year
  `).all();

  const recentNotices = db.prepare(`SELECT id, title, priority, created_at FROM notices ORDER BY created_at DESC LIMIT 5`).all();

  const recentPaymentsList = db.prepare(`
    SELECT p.id, p.amount, p.receipt_no, p.paid_at, s.first_name, s.last_name, s.roll_no
    FROM fee_payments p JOIN students s ON s.id = p.student_id ORDER BY p.paid_at DESC LIMIT 5
  `).all();

  const recentLogins = db.prepare(`
    SELECT id, email, role, last_login_at FROM users
    WHERE last_login_at IS NOT NULL ORDER BY last_login_at DESC LIMIT 5
  `).all();

  res.json({
    success: true,
    data: {
      counts: { totalStudents, totalFaculty, totalCourses, totalOfferings, totalEnrollments, totalBooks, totalBookCopies, issuedBooks, hostels: hostels.c },
      finance: { totalRevenue, recentPayments },
      attendanceToday: attMap,
      hostel: { capacity: hostels.capacity, occupied: hostels.occupied },
      charts: { studentsByDept, studentsByBatch },
      recent: { notices: recentNotices, payments: recentPaymentsList, logins: recentLogins }
    }
  });
}));

router.get('/audit-logs', authorize('admin'), [
  query('page').optional().toInt().isInt({ min: 1 }),
  query('pageSize').optional().toInt().isInt({ min: 1, max: 100 })
], validate, asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 50 } = req.query;
  const offset = (page - 1) * pageSize;
  const total = db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c;
  const rows = db.prepare(`
    SELECT a.*, u.email, u.role FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT ? OFFSET ?
  `).all(pageSize, offset);
  res.json({ success: true, data: { items: rows, total, page: +page, pageSize: +pageSize } });
}));

module.exports = router;
