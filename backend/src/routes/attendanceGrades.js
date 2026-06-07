const express = require('express');
const { body, param, query } = require('express-validator');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, AppError, validate } = require('../middleware/errorHandler');
const { gradeLetter, gpa, todayISO, isValidDate } = require('../utils/helpers');
const audit = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

const offeringOwnedByFaculty = (offeringId, userId) => {
  const f = db.prepare('SELECT id FROM faculty WHERE user_id = ?').get(userId);
  if (!f) return false;
  const o = db.prepare('SELECT faculty_id FROM course_offerings WHERE id = ?').get(offeringId);
  return o && o.faculty_id === f.id;
};

const isFacultyForOffering = (user, offeringId) => {
  if (user.role === 'admin') return true;
  if (user.role === 'faculty') return offeringOwnedByFaculty(offeringId, user.id);
  return false;
};

// =========================
// ATTENDANCE
// =========================
router.post('/attendance/mark', authorize('admin', 'faculty'), [
  body('offeringId').isInt(),
  body('sessionDate').custom((v) => isValidDate(v) || Promise.reject('Invalid date')),
  body('records').isArray({ min: 1 })
], validate, asyncHandler(async (req, res) => {
  const { offeringId, sessionDate, records } = req.body;
  if (!isFacultyForOffering(req.user, offeringId)) throw new AppError('Not authorized for this offering', 403, 'FORBIDDEN');

  // Validate inner record shape — express-validator v7 doesn't easily walk nested array elements
  const validStatuses = ['present', 'absent', 'late', 'excused'];
  for (let i = 0; i < records.length; i++) {
    const r = records[i] || {};
    if (!Number.isInteger(r.studentId)) {
      throw new AppError(`records[${i}].studentId must be an integer`, 400, 'VALIDATION');
    }
    if (!validStatuses.includes(r.status)) {
      throw new AppError(`records[${i}].status must be one of: ${validStatuses.join(', ')}`, 400, 'VALIDATION');
    }
  }

  const enrollments = db.prepare(`
    SELECT e.id, e.student_id FROM enrollments e WHERE e.offering_id = ? AND e.status='enrolled'
  `).all(offeringId);
  const enrollMap = new Map(enrollments.map(e => [e.student_id, e.id]));

  const stmt = db.prepare(`
    INSERT INTO attendance (enrollment_id, session_date, status, remarks, marked_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(enrollment_id, session_date) DO UPDATE SET
      status = excluded.status, remarks = excluded.remarks, marked_by = excluded.marked_by, marked_at = datetime('now')
  `);

  const txn = db.transaction((items) => {
    let n = 0;
    for (const r of items) {
      const eid = enrollMap.get(r.studentId);
      if (!eid) continue;
      stmt.run(eid, sessionDate, r.status, r.remarks || null, req.user.id);
      n++;
    }
    return n;
  });

  const n = txn(records);
  audit.log({ userId: req.user.id, action: 'MARK_ATTENDANCE', resource: 'offering:' + offeringId, details: { sessionDate, count: n }, ip: req.ip });
  res.json({ success: true, data: { recorded: n, sessionDate } });
}));

router.get('/attendance/offering/:offeringId', [
  param('offeringId').isInt(),
  query('sessionDate').optional().isISO8601(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601()
], validate, asyncHandler(async (req, res) => {
  const { sessionDate, from, to } = req.query;
  const where = ['e.offering_id = ?'];
  const params = [req.params.offeringId];
  if (sessionDate) { where.push('a.session_date = ?'); params.push(sessionDate); }
  if (from) { where.push('a.session_date >= ?'); params.push(from); }
  if (to) { where.push('a.session_date <= ?'); params.push(to); }
  const rows = db.prepare(`
    SELECT a.id, a.session_date, a.status, a.remarks, a.enrollment_id,
           s.id AS student_id, s.roll_no, s.first_name, s.last_name
    FROM attendance a
    JOIN enrollments e ON e.id = a.enrollment_id
    JOIN students s ON s.id = e.student_id
    WHERE ${where.join(' AND ')}
    ORDER BY a.session_date DESC, s.roll_no
  `).all(...params);
  res.json({ success: true, data: rows });
}));

router.get('/attendance/summary/offering/:offeringId', [param('offeringId').isInt()], validate, asyncHandler(async (req, res) => {
  const rows = db.prepare(`
    SELECT s.id AS student_id, s.roll_no, s.first_name, s.last_name,
      SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) AS absent,
      SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) AS late,
      SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END) AS excused,
      COUNT(a.id) AS total,
      CASE WHEN COUNT(a.id) > 0
        THEN ROUND(100.0 * SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) / COUNT(a.id), 2)
        ELSE 0 END AS pct
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN attendance a ON a.enrollment_id = e.id
    WHERE e.offering_id = ? AND e.status='enrolled'
    GROUP BY s.id
    ORDER BY s.roll_no
  `).all(req.params.offeringId);
  res.json({ success: true, data: rows });
}));

router.get('/attendance/student/:studentId', [param('studentId').isInt()], validate, asyncHandler(async (req, res) => {
  if (req.user.role === 'student') {
    const s = db.prepare('SELECT user_id FROM students WHERE id = ?').get(req.params.studentId);
    if (!s || s.user_id !== req.user.id) throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
  const rows = db.prepare(`
    SELECT a.id, a.session_date, a.status, a.remarks,
           c.code AS course_code, c.name AS course_name, co.term
    FROM attendance a
    JOIN enrollments e ON e.id = a.enrollment_id
    JOIN course_offerings co ON co.id = e.offering_id
    JOIN courses c ON c.id = co.course_id
    WHERE e.student_id = ?
    ORDER BY a.session_date DESC
  `).all(req.params.studentId);
  res.json({ success: true, data: rows });
}));

// =========================
// ASSESSMENTS
// =========================
router.get('/assessments/offering/:offeringId', [param('offeringId').isInt()], validate, asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM assessments WHERE offering_id = ? ORDER BY due_date, id').all(req.params.offeringId);
  res.json({ success: true, data: rows });
}));

router.post('/assessments', authorize('admin', 'faculty'), [
  body('offeringId').isInt(),
  body('name').isString().isLength({ min: 1 }),
  body('type').isIn(['quiz', 'assignment', 'midterm', 'final', 'project', 'lab']),
  body('maxMarks').isFloat({ min: 0 }),
  body('weight').isFloat({ min: 0, max: 1 })
], validate, asyncHandler(async (req, res) => {
  const { offeringId, name, type, maxMarks, weight, dueDate } = req.body;
  if (!isFacultyForOffering(req.user, offeringId)) throw new AppError('Not authorized', 403, 'FORBIDDEN');
  const info = db.prepare(`
    INSERT INTO assessments (offering_id, name, type, max_marks, weight, due_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(offeringId, name, type, maxMarks, weight, dueDate || null);
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM assessments WHERE id = ?').get(info.lastInsertRowid) });
}));

router.put('/assessments/:id', authorize('admin', 'faculty'), [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 1 }),
  body('type').optional().isIn(['quiz', 'assignment', 'midterm', 'final', 'project', 'lab']),
  body('maxMarks').optional().isFloat({ min: 0 }),
  body('weight').optional().isFloat({ min: 0, max: 1 }),
  body('dueDate').optional().isISO8601()
], validate, asyncHandler(async (req, res) => {
  const a = db.prepare('SELECT * FROM assessments WHERE id = ?').get(req.params.id);
  if (!a) throw new AppError('Assessment not found', 404, 'NOT_FOUND');
  if (!isFacultyForOffering(req.user, a.offering_id)) throw new AppError('Not authorized', 403, 'FORBIDDEN');
  const b = req.body;
  db.prepare(`
    UPDATE assessments SET name = COALESCE(?, name), type = COALESCE(?, type),
      max_marks = COALESCE(?, max_marks), weight = COALESCE(?, weight), due_date = COALESCE(?, due_date)
    WHERE id = ?
  `).run(b.name ?? null, b.type ?? null, b.maxMarks ?? null, b.weight ?? null, b.dueDate ?? null, req.params.id);
  res.json({ success: true, data: db.prepare('SELECT * FROM assessments WHERE id = ?').get(req.params.id) });
}));

router.delete('/assessments/:id', authorize('admin', 'faculty'), [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const a = db.prepare('SELECT offering_id FROM assessments WHERE id = ?').get(req.params.id);
  if (!a) throw new AppError('Not found', 404, 'NOT_FOUND');
  if (!isFacultyForOffering(req.user, a.offering_id)) throw new AppError('Not authorized', 403, 'FORBIDDEN');
  db.prepare('DELETE FROM assessments WHERE id = ?').run(req.params.id);
  res.json({ success: true, data: { deleted: true } });
}));

// =========================
// GRADES
// =========================
router.post('/grades', authorize('admin', 'faculty'), [
  body('assessmentId').isInt(),
  body('records').isArray({ min: 1 })
], validate, asyncHandler(async (req, res) => {
  const { assessmentId, records } = req.body;
  const a = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId);
  if (!a) throw new AppError('Assessment not found', 404, 'NOT_FOUND');
  if (!isFacultyForOffering(req.user, a.offering_id)) throw new AppError('Not authorized', 403, 'FORBIDDEN');

  // Validate inner record shape — express-validator v7 doesn't easily walk nested array elements
  for (let i = 0; i < records.length; i++) {
    const r = records[i] || {};
    if (!Number.isInteger(r.enrollmentId)) {
      throw new AppError(`records[${i}].enrollmentId must be an integer`, 400, 'VALIDATION');
    }
    if (typeof r.marksObtained !== 'number' || Number.isNaN(r.marksObtained) || r.marksObtained < 0) {
      throw new AppError(`records[${i}].marksObtained must be a non-negative number`, 400, 'VALIDATION');
    }
  }

  const stmt = db.prepare(`
    INSERT INTO grades (enrollment_id, assessment_id, marks_obtained, remarks, graded_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(enrollment_id, assessment_id) DO UPDATE SET
      marks_obtained = excluded.marks_obtained, remarks = excluded.remarks, graded_by = excluded.graded_by, graded_at = datetime('now')
  `);

  const txn = db.transaction((items) => {
    let n = 0;
    for (const r of items) {
      stmt.run(r.enrollmentId, assessmentId, r.marksObtained, r.remarks || null, req.user.id);
      n++;
    }
    return n;
  });
  const n = txn(records);
  audit.log({ userId: req.user.id, action: 'GRADE', resource: 'assessment:' + assessmentId, details: { count: n }, ip: req.ip });
  res.json({ success: true, data: { recorded: n } });
}));

router.get('/grades/offering/:offeringId', [param('offeringId').isInt()], validate, asyncHandler(async (req, res) => {
  const assessments = db.prepare('SELECT * FROM assessments WHERE offering_id = ? ORDER BY id').all(req.params.offeringId);
  const enrollments = db.prepare(`
    SELECT e.id AS enrollment_id, s.id AS student_id, s.roll_no, s.first_name, s.last_name
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE e.offering_id = ? AND e.status='enrolled'
    ORDER BY s.roll_no
  `).all(req.params.offeringId);

  const gradeMap = new Map();
  for (const a of assessments) {
    const rows = db.prepare('SELECT enrollment_id, marks_obtained, remarks FROM grades WHERE assessment_id = ?').all(a.id);
    for (const r of rows) {
      if (!gradeMap.has(r.enrollment_id)) gradeMap.set(r.enrollment_id, {});
      gradeMap.get(r.enrollment_id)[a.id] = r;
    }
  }

  const totalWeight = assessments.reduce((s, a) => s + (a.weight || 0), 0) || 1;
  const enriched = enrollments.map(e => {
    const perAssess = {};
    let weightedPct = 0;
    for (const a of assessments) {
      const g = gradeMap.get(e.enrollment_id)?.[a.id];
      const marks = g?.marks_obtained;
      const pct = marks == null ? null : (marks / a.max_marks) * 100;
      perAssess[a.id] = { name: a.name, type: a.type, maxMarks: a.max_marks, weight: a.weight, marksObtained: marks, pct, remarks: g?.remarks ?? null };
      if (pct != null) weightedPct += (pct * a.weight);
    }
    const finalPct = totalWeight > 0 ? (weightedPct / totalWeight) : 0;
    return {
      ...e,
      perAssessment: perAssess,
      finalPct: Math.round(finalPct * 100) / 100,
      finalGrade: gradeLetter(finalPct),
      gpa: gpa(finalPct)
    };
  });

  res.json({ success: true, data: { assessments, students: enriched } });
}));

router.get('/grades/student/:studentId', [param('studentId').isInt()], validate, asyncHandler(async (req, res) => {
  if (req.user.role === 'student') {
    const s = db.prepare('SELECT user_id FROM students WHERE id = ?').get(req.params.studentId);
    if (!s || s.user_id !== req.user.id) throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
  const rows = db.prepare(`
    SELECT co.id AS offering_id, c.code, c.name, c.credits, co.term,
           (SELECT ROUND(AVG(g.marks_obtained * 1.0 / a.max_marks) * 100, 2)
              FROM grades g JOIN assessments a ON a.id = g.assessment_id
              WHERE g.enrollment_id = e.id) AS pct
    FROM enrollments e
    JOIN course_offerings co ON co.id = e.offering_id
    JOIN courses c ON c.id = co.course_id
    WHERE e.student_id = ? AND e.status='enrolled'
  `).all(req.params.studentId);
  const out = rows.map(r => ({ ...r, grade: gradeLetter(r.pct || 0), gpa: gpa(r.pct || 0) }));
  const totalCredits = out.reduce((s, r) => s + (r.credits || 0), 0);
  const totalPoints = out.reduce((s, r) => s + (r.gpa * (r.credits || 0)), 0);
  const cgpa = totalCredits ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0;
  res.json({ success: true, data: { courses: out, cgpa, totalCredits } });
}));

module.exports = router;
