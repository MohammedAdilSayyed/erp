const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, AppError, validate } = require('../middleware/errorHandler');
const { paginate, buildPageResponse, isValidEmail, isValidDate } = require('../utils/helpers');
const audit = require('../middleware/audit');

const router = express.Router();

router.use(authenticate);

// =========================
// DEPARTMENTS
// =========================
router.get('/departments', asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM departments ORDER BY name').all();
  res.json({ success: true, data: rows });
}));

router.post('/departments', authorize('admin'), [
  body('code').isString().isLength({ min: 1, max: 20 }),
  body('name').isString().isLength({ min: 1, max: 100 })
], validate, asyncHandler(async (req, res) => {
  const { code, name, head } = req.body;
  try {
    const info = db.prepare('INSERT INTO departments (code, name, head) VALUES (?, ?, ?)').run(code.toUpperCase(), name, head || null);
    const row = db.prepare('SELECT * FROM departments WHERE id = ?').get(info.lastInsertRowid);
    audit.log({ userId: req.user.id, action: 'CREATE', resource: 'department', details: row, ip: req.ip });
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new AppError('Department code already exists', 409, 'CONFLICT');
    throw e;
  }
}));

router.put('/departments/:id', authorize('admin'), [
  param('id').isInt(),
  body('code').optional().isString().isLength({ min: 1, max: 20 }),
  body('name').optional().isString().isLength({ min: 1, max: 100 })
], validate, asyncHandler(async (req, res) => {
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!dept) throw new AppError('Department not found', 404, 'NOT_FOUND');
  const { code, name, head } = req.body;
  db.prepare('UPDATE departments SET code = COALESCE(?, code), name = COALESCE(?, name), head = COALESCE(?, head) WHERE id = ?')
    .run(code?.toUpperCase() ?? null, name ?? null, head ?? null, req.params.id);
  audit.log({ userId: req.user.id, action: 'UPDATE', resource: 'department:' + req.params.id, details: req.body, ip: req.ip });
  res.json({ success: true, data: db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id) });
}));

router.delete('/departments/:id', authorize('admin'), [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const info = db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  if (!info.changes) throw new AppError('Department not found', 404, 'NOT_FOUND');
  audit.log({ userId: req.user.id, action: 'DELETE', resource: 'department:' + req.params.id, ip: req.ip });
  res.json({ success: true, data: { deleted: true } });
}));

// =========================
// STUDENTS
// =========================
router.get('/students', asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req);
  const { q, departmentId, batchYear, status } = req.query;

  const filters = [];
  const params = [];
  if (q) {
    filters.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR s.roll_no LIKE ? OR u.email LIKE ?)');
    const like = '%' + q + '%';
    params.push(like, like, like, like);
  }
  if (departmentId) { filters.push('s.department_id = ?'); params.push(departmentId); }
  if (batchYear) { filters.push('s.batch_year = ?'); params.push(batchYear); }
  if (status) { filters.push('s.status = ?'); params.push(status); }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM students s JOIN users u ON u.id = s.user_id ${where}`).get(...params).c;
  const rows = db.prepare(`
    SELECT s.*, u.email, d.name AS department_name, d.code AS department_code
    FROM students s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN departments d ON d.id = s.department_id
    ${where}
    ORDER BY s.roll_no
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  res.json({ success: true, ...buildPageResponse(rows, total, page, pageSize) });
}));

router.get('/students/:id', [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const s = db.prepare(`
    SELECT s.*, u.email, d.name AS department_name
    FROM students s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN departments d ON d.id = s.department_id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!s) throw new AppError('Student not found', 404, 'NOT_FOUND');

  const enrollments = db.prepare(`
    SELECT e.id, e.status, co.term, co.academic_year, co.section, c.code AS course_code, c.name AS course_name, c.credits
    FROM enrollments e
    JOIN course_offerings co ON co.id = e.offering_id
    JOIN courses c ON c.id = co.course_id
    WHERE e.student_id = ?
    ORDER BY co.term DESC
  `).all(req.params.id);

  const payments = db.prepare(`
    SELECT id, receipt_no, amount, payment_mode, status, paid_at
    FROM fee_payments WHERE student_id = ? ORDER BY paid_at DESC LIMIT 20
  `).all(req.params.id);

  res.json({ success: true, data: { ...s, enrollments, payments } });
}));

router.post('/students', authorize('admin'), [
  body('email').custom((v) => isValidEmail(v) || Promise.reject('Invalid email')),
  body('rollNo').isString().isLength({ min: 1 }),
  body('firstName').isString().isLength({ min: 1 }),
  body('lastName').isString().isLength({ min: 1 }),
  body('password').optional().isString().isLength({ min: 6 }),
  body('dob').optional().custom((v) => isValidDate(v) || Promise.reject('Invalid date'))
], validate, asyncHandler(async (req, res) => {
  const {
    email, password, rollNo, firstName, lastName, dob, gender, phone, address, city, state, pincode,
    guardianName, guardianPhone, departmentId, program, batchYear, currentSemester
  } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) throw new AppError('Email already in use', 409, 'CONFLICT');

  const tempPwd = password || ('Pass@' + Math.random().toString(36).slice(2, 8));
  const hash = await bcrypt.hash(tempPwd, 10);

  const txn = db.transaction(() => {
    const userInfo = db.prepare(`
      INSERT INTO users (email, password_hash, role, must_change_password)
      VALUES (?, ?, 'student', 1)
    `).run(email.toLowerCase(), hash);
    const userId = userInfo.lastInsertRowid;
    const sInfo = db.prepare(`
      INSERT INTO students (user_id, roll_no, first_name, last_name, dob, gender, phone, address, city, state, pincode,
        guardian_name, guardian_phone, department_id, program, batch_year, current_semester)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, rollNo, firstName, lastName, dob || null, gender || null, phone || null, address || null,
      city || null, state || null, pincode || null, guardianName || null, guardianPhone || null,
      departmentId || null, program || null, batchYear || null, currentSemester || 1);
    return { userId, studentId: sInfo.lastInsertRowid };
  });

  let result;
  try { result = txn(); }
  catch (e) {
    if (String(e).includes('UNIQUE')) throw new AppError('Roll number already exists', 409, 'CONFLICT');
    throw e;
  }

  audit.log({ userId: req.user.id, action: 'CREATE_STUDENT', resource: 'student:' + result.studentId, details: { email, rollNo }, ip: req.ip });

  const created = db.prepare('SELECT * FROM students WHERE id = ?').get(result.studentId);
  res.status(201).json({ success: true, data: { ...created, tempPassword: tempPwd } });
}));

router.put('/students/:id', authorize('admin'), [
  param('id').isInt(),
  body('firstName').optional().isString().isLength({ min: 1 }),
  body('lastName').optional().isString().isLength({ min: 1 }),
  body('dob').optional().custom((v) => isValidDate(v) || Promise.reject('Invalid date')),
  body('currentSemester').optional().isInt({ min: 1 }),
  body('status').optional().isString().isLength({ min: 1 })
], validate, asyncHandler(async (req, res) => {
  const s = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!s) throw new AppError('Student not found', 404, 'NOT_FOUND');
  const b = req.body;
  db.prepare(`
    UPDATE students SET
      first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
      dob = COALESCE(?, dob), gender = COALESCE(?, gender),
      phone = COALESCE(?, phone), address = COALESCE(?, address),
      city = COALESCE(?, city), state = COALESCE(?, state), pincode = COALESCE(?, pincode),
      guardian_name = COALESCE(?, guardian_name), guardian_phone = COALESCE(?, guardian_phone),
      department_id = COALESCE(?, department_id), program = COALESCE(?, program),
      batch_year = COALESCE(?, batch_year), current_semester = COALESCE(?, current_semester),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(b.firstName ?? null, b.lastName ?? null, b.dob ?? null, b.gender ?? null,
    b.phone ?? null, b.address ?? null, b.city ?? null, b.state ?? null, b.pincode ?? null,
    b.guardianName ?? null, b.guardianPhone ?? null, b.departmentId ?? null, b.program ?? null,
    b.batchYear ?? null, b.currentSemester ?? null, b.status ?? null, req.params.id);
  audit.log({ userId: req.user.id, action: 'UPDATE_STUDENT', resource: 'student:' + req.params.id, ip: req.ip });
  res.json({ success: true, data: db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id) });
}));

router.delete('/students/:id', authorize('admin'), [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const s = db.prepare('SELECT user_id FROM students WHERE id = ?').get(req.params.id);
  if (!s) throw new AppError('Student not found', 404, 'NOT_FOUND');
  db.prepare('DELETE FROM users WHERE id = ?').run(s.user_id);
  audit.log({ userId: req.user.id, action: 'DELETE_STUDENT', resource: 'student:' + req.params.id, ip: req.ip });
  res.json({ success: true, data: { deleted: true } });
}));

// =========================
// FACULTY
// =========================
router.get('/faculty', asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req);
  const { q, departmentId, status } = req.query;
  const filters = [];
  const params = [];
  if (q) {
    filters.push('(f.first_name LIKE ? OR f.last_name LIKE ? OR f.employee_id LIKE ? OR u.email LIKE ?)');
    const like = '%' + q + '%';
    params.push(like, like, like, like);
  }
  if (departmentId) { filters.push('f.department_id = ?'); params.push(departmentId); }
  if (status) { filters.push('f.status = ?'); params.push(status); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM faculty f JOIN users u ON u.id = f.user_id ${where}`).get(...params).c;
  const rows = db.prepare(`
    SELECT f.*, u.email, d.name AS department_name
    FROM faculty f
    JOIN users u ON u.id = f.user_id
    LEFT JOIN departments d ON d.id = f.department_id
    ${where}
    ORDER BY f.employee_id
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);
  res.json({ success: true, ...buildPageResponse(rows, total, page, pageSize) });
}));

router.get('/faculty/:id', [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const f = db.prepare(`
    SELECT f.*, u.email, d.name AS department_name
    FROM faculty f
    JOIN users u ON u.id = f.user_id
    LEFT JOIN departments d ON d.id = f.department_id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!f) throw new AppError('Faculty not found', 404, 'NOT_FOUND');

  const offerings = db.prepare(`
    SELECT co.id, co.term, co.section, c.code, c.name
    FROM course_offerings co
    JOIN courses c ON c.id = co.course_id
    WHERE co.faculty_id = ? AND co.is_active = 1
  `).all(req.params.id);

  res.json({ success: true, data: { ...f, offerings } });
}));

router.post('/faculty', authorize('admin'), [
  body('email').custom((v) => isValidEmail(v) || Promise.reject('Invalid email')),
  body('employeeId').isString().isLength({ min: 1 }),
  body('firstName').isString().isLength({ min: 1 }),
  body('lastName').isString().isLength({ min: 1 })
], validate, asyncHandler(async (req, res) => {
  const { email, password, employeeId, firstName, lastName, phone, designation, qualification, departmentId } = req.body;
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())) {
    throw new AppError('Email already in use', 409, 'CONFLICT');
  }
  const tempPwd = password || ('Pass@' + Math.random().toString(36).slice(2, 8));
  const hash = await bcrypt.hash(tempPwd, 10);

  let result;
  try {
    result = db.transaction(() => {
      const u = db.prepare(`INSERT INTO users (email, password_hash, role, must_change_password) VALUES (?, ?, 'faculty', 1)`)
        .run(email.toLowerCase(), hash);
      const f = db.prepare(`
        INSERT INTO faculty (user_id, employee_id, first_name, last_name, phone, designation, qualification, department_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(u.lastInsertRowid, employeeId, firstName, lastName, phone || null, designation || null, qualification || null, departmentId || null);
      return { userId: u.lastInsertRowid, facultyId: f.lastInsertRowid };
    })();
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new AppError('Employee ID already exists', 409, 'CONFLICT');
    throw e;
  }

  audit.log({ userId: req.user.id, action: 'CREATE_FACULTY', resource: 'faculty:' + result.facultyId, ip: req.ip });
  const created = db.prepare('SELECT * FROM faculty WHERE id = ?').get(result.facultyId);
  res.status(201).json({ success: true, data: { ...created, tempPassword: tempPwd } });
}));

router.put('/faculty/:id', authorize('admin'), [
  param('id').isInt(),
  body('firstName').optional().isString().isLength({ min: 1 }),
  body('lastName').optional().isString().isLength({ min: 1 }),
  body('phone').optional().isString(),
  body('designation').optional().isString(),
  body('qualification').optional().isString(),
  body('departmentId').optional().isInt(),
  body('status').optional().isString().isLength({ min: 1 })
], validate, asyncHandler(async (req, res) => {
  const f = db.prepare('SELECT * FROM faculty WHERE id = ?').get(req.params.id);
  if (!f) throw new AppError('Faculty not found', 404, 'NOT_FOUND');
  const b = req.body;
  db.prepare(`
    UPDATE faculty SET
      first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
      phone = COALESCE(?, phone), designation = COALESCE(?, designation),
      qualification = COALESCE(?, qualification), department_id = COALESCE(?, department_id),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(b.firstName ?? null, b.lastName ?? null, b.phone ?? null, b.designation ?? null,
    b.qualification ?? null, b.departmentId ?? null, b.status ?? null, req.params.id);
  audit.log({ userId: req.user.id, action: 'UPDATE_FACULTY', resource: 'faculty:' + req.params.id, ip: req.ip });
  res.json({ success: true, data: db.prepare('SELECT * FROM faculty WHERE id = ?').get(req.params.id) });
}));

router.delete('/faculty/:id', authorize('admin'), [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const f = db.prepare('SELECT user_id FROM faculty WHERE id = ?').get(req.params.id);
  if (!f) throw new AppError('Faculty not found', 404, 'NOT_FOUND');
  db.prepare('DELETE FROM users WHERE id = ?').run(f.user_id);
  audit.log({ userId: req.user.id, action: 'DELETE_FACULTY', resource: 'faculty:' + req.params.id, ip: req.ip });
  res.json({ success: true, data: { deleted: true } });
}));

// =========================
// COURSES
// =========================
router.get('/courses', asyncHandler(async (req, res) => {
  const { q, departmentId, semester, program } = req.query;
  const filters = [];
  const params = [];
  if (q) {
    filters.push('(c.code LIKE ? OR c.name LIKE ?)');
    const like = '%' + q + '%';
    params.push(like, like);
  }
  if (departmentId) { filters.push('c.department_id = ?'); params.push(departmentId); }
  if (semester) { filters.push('c.semester = ?'); params.push(semester); }
  if (program) { filters.push('c.program = ?'); params.push(program); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT c.*, d.name AS department_name FROM courses c LEFT JOIN departments d ON d.id = c.department_id ${where}
    ORDER BY c.code
  `).all(...params);
  res.json({ success: true, data: rows });
}));

router.post('/courses', authorize('admin'), [
  body('code').isString().isLength({ min: 1 }),
  body('name').isString().isLength({ min: 1 }),
  body('credits').optional().isInt({ min: 0 }),
  body('departmentId').optional().isInt(),
  body('semester').optional().isString(),
  body('program').optional().isString(),
  body('isElective').optional().isBoolean()
], validate, asyncHandler(async (req, res) => {
  const { code, name, description, credits, departmentId, semester, program, isElective } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO courses (code, name, description, credits, department_id, semester, program, is_elective)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code.toUpperCase(), name, description || null, credits || 3, departmentId || null, semester || null, program || null, isElective ? 1 : 0);
    audit.log({ userId: req.user.id, action: 'CREATE_COURSE', resource: 'course:' + info.lastInsertRowid, ip: req.ip });
    res.status(201).json({ success: true, data: db.prepare('SELECT * FROM courses WHERE id = ?').get(info.lastInsertRowid) });
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new AppError('Course code already exists', 409, 'CONFLICT');
    throw e;
  }
}));

router.put('/courses/:id', authorize('admin'), [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 1 }),
  body('description').optional().isString(),
  body('credits').optional().isInt({ min: 0 }),
  body('departmentId').optional().isInt(),
  body('semester').optional().isString(),
  body('program').optional().isString(),
  body('isElective').optional().isBoolean()
], validate, asyncHandler(async (req, res) => {
  const c = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!c) throw new AppError('Course not found', 404, 'NOT_FOUND');
  const b = req.body;
  db.prepare(`
    UPDATE courses SET
      name = COALESCE(?, name), description = COALESCE(?, description),
      credits = COALESCE(?, credits), department_id = COALESCE(?, department_id),
      semester = COALESCE(?, semester), program = COALESCE(?, program),
      is_elective = COALESCE(?, is_elective)
    WHERE id = ?
  `).run(b.name ?? null, b.description ?? null, b.credits ?? null, b.departmentId ?? null,
    b.semester ?? null, b.program ?? null, b.isElective == null ? null : (b.isElective ? 1 : 0), req.params.id);
  res.json({ success: true, data: db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id) });
}));

router.delete('/courses/:id', authorize('admin'), [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const info = db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
  if (!info.changes) throw new AppError('Course not found', 404, 'NOT_FOUND');
  audit.log({ userId: req.user.id, action: 'DELETE_COURSE', resource: 'course:' + req.params.id, ip: req.ip });
  res.json({ success: true, data: { deleted: true } });
}));

// =========================
// COURSE OFFERINGS
// =========================
router.get('/offerings', asyncHandler(async (req, res) => {
  const { term, facultyId, isActive } = req.query;
  const filters = [];
  const params = [];
  if (term) { filters.push('co.term = ?'); params.push(term); }
  if (facultyId) { filters.push('co.faculty_id = ?'); params.push(facultyId); }
  if (isActive !== undefined) {
    const active = String(isActive).toLowerCase();
    if (active === 'true' || active === '1') filters.push('co.is_active = ?'), params.push(1);
    else if (active === 'false' || active === '0') filters.push('co.is_active = ?'), params.push(0);
  }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT co.*, c.code AS course_code, c.name AS course_name, c.credits,
           f.first_name || ' ' || f.last_name AS faculty_name, f.employee_id,
           (SELECT COUNT(*) FROM enrollments e WHERE e.offering_id = co.id AND e.status='enrolled') AS enrolled_count
    FROM course_offerings co
    JOIN courses c ON c.id = co.course_id
    LEFT JOIN faculty f ON f.id = co.faculty_id
    ${where}
    ORDER BY co.term DESC, c.code
  `).all(...params);
  res.json({ success: true, data: rows });
}));

router.post('/offerings', authorize('admin'), [
  body('courseId').isInt(),
  body('term').isString().isLength({ min: 1 }),
  body('academicYear').isString().isLength({ min: 1 }),
  body('facultyId').optional().isInt(),
  body('capacity').optional().isInt({ min: 1 }),
  body('section').optional().isString(),
  body('room').optional().isString(),
  body('schedule').optional().isString(),
  body('isActive').optional().isBoolean()
], validate, asyncHandler(async (req, res) => {
  const { courseId, facultyId, section, term, academicYear, capacity, room, schedule } = req.body;
  const info = db.prepare(`
    INSERT INTO course_offerings (course_id, faculty_id, section, term, academic_year, capacity, room, schedule)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(courseId, facultyId || null, section || 'A', term, academicYear, capacity || 60, room || null, schedule || null);
  audit.log({ userId: req.user.id, action: 'CREATE_OFFERING', resource: 'offering:' + info.lastInsertRowid, ip: req.ip });
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM course_offerings WHERE id = ?').get(info.lastInsertRowid) });
}));

router.put('/offerings/:id', authorize('admin', 'faculty'), [
  param('id').isInt(),
  body('facultyId').optional().isInt(),
  body('section').optional().isString(),
  body('capacity').optional().isInt({ min: 1 }),
  body('room').optional().isString(),
  body('schedule').optional().isString(),
  body('isActive').optional().isBoolean()
], validate, asyncHandler(async (req, res) => {
  const o = db.prepare('SELECT * FROM course_offerings WHERE id = ?').get(req.params.id);
  if (!o) throw new AppError('Offering not found', 404, 'NOT_FOUND');
  if (req.user.role === 'faculty') {
    const fac = db.prepare('SELECT id FROM faculty WHERE user_id = ?').get(req.user.id);
    if (!fac || o.faculty_id !== fac.id) throw new AppError('Not your offering', 403, 'FORBIDDEN');
  }
  const b = req.body;
  db.prepare(`
    UPDATE course_offerings SET
      faculty_id = COALESCE(?, faculty_id), section = COALESCE(?, section),
      capacity = COALESCE(?, capacity), room = COALESCE(?, room),
      schedule = COALESCE(?, schedule), is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(b.facultyId ?? null, b.section ?? null, b.capacity ?? null, b.room ?? null, b.schedule ?? null,
    b.isActive == null ? null : (b.isActive ? 1 : 0), req.params.id);
  res.json({ success: true, data: db.prepare('SELECT * FROM course_offerings WHERE id = ?').get(req.params.id) });
}));

router.delete('/offerings/:id', authorize('admin'), [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const info = db.prepare('DELETE FROM course_offerings WHERE id = ?').run(req.params.id);
  if (!info.changes) throw new AppError('Offering not found', 404, 'NOT_FOUND');
  audit.log({ userId: req.user.id, action: 'DELETE_OFFERING', resource: 'offering:' + req.params.id, ip: req.ip });
  res.json({ success: true, data: { deleted: true } });
}));

router.get('/offerings/:id/roster', [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const rows = db.prepare(`
    SELECT e.id AS enrollment_id, e.status AS enrollment_status, e.enrolled_at,
           s.id AS student_id, s.roll_no, s.first_name, s.last_name, u.email,
           (SELECT COUNT(*) FROM attendance a WHERE a.enrollment_id = e.id AND a.status='present') AS present,
           (SELECT COUNT(*) FROM attendance a WHERE a.enrollment_id = e.id AND a.status='absent') AS absent,
           (SELECT COUNT(*) FROM attendance a WHERE a.enrollment_id = e.id) AS total
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN users u ON u.id = s.user_id
    WHERE e.offering_id = ?
    ORDER BY s.roll_no
  `).all(req.params.id);
  res.json({ success: true, data: rows });
}));

// =========================
// ENROLLMENTS
// =========================
router.post('/enrollments', authorize('admin'), [
  body('studentId').isInt(),
  body('offeringId').isInt()
], validate, asyncHandler(async (req, res) => {
  const { studentId, offeringId } = req.body;
  const o = db.prepare('SELECT capacity FROM course_offerings WHERE id = ?').get(offeringId);
  if (!o) throw new AppError('Offering not found', 404, 'NOT_FOUND');
  const cnt = db.prepare(`SELECT COUNT(*) AS c FROM enrollments WHERE offering_id = ? AND status='enrolled'`).get(offeringId).c;
  if (cnt >= o.capacity) throw new AppError('Offering is full', 409, 'FULL');
  try {
    const info = db.prepare(`INSERT INTO enrollments (student_id, offering_id) VALUES (?, ?)`).run(studentId, offeringId);
    audit.log({ userId: req.user.id, action: 'ENROLL', resource: `student:${studentId}/offering:${offeringId}`, ip: req.ip });
    res.status(201).json({ success: true, data: { id: info.lastInsertRowid } });
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new AppError('Student already enrolled', 409, 'CONFLICT');
    throw e;
  }
}));

router.delete('/enrollments/:id', authorize('admin'), [param('id').isInt()], validate, asyncHandler(async (req, res) => {
  const info = db.prepare(`UPDATE enrollments SET status='dropped' WHERE id = ?`).run(req.params.id);
  if (!info.changes) throw new AppError('Enrollment not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: { updated: true } });
}));

// My enrollments (student)
router.get('/my/enrollments', asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new AppError('Students only', 403, 'FORBIDDEN');
  const s = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
  if (!s) return res.json({ success: true, data: [] });
  const rows = db.prepare(`
    SELECT e.id, e.status, e.enrolled_at, co.id AS offering_id, co.term, co.section, co.schedule, co.room,
           c.id AS course_id, c.code, c.name, c.credits,
           f.first_name || ' ' || f.last_name AS faculty_name
    FROM enrollments e
    JOIN course_offerings co ON co.id = e.offering_id
    JOIN courses c ON c.id = co.course_id
    LEFT JOIN faculty f ON f.id = co.faculty_id
    WHERE e.student_id = ? AND e.status = 'enrolled'
    ORDER BY co.term DESC
  `).all(s.id);
  res.json({ success: true, data: rows });
}));

// My offerings (faculty)
router.get('/my/offerings', asyncHandler(async (req, res) => {
  if (req.user.role !== 'faculty') throw new AppError('Faculty only', 403, 'FORBIDDEN');
  const f = db.prepare('SELECT id FROM faculty WHERE user_id = ?').get(req.user.id);
  if (!f) return res.json({ success: true, data: [] });
  const rows = db.prepare(`
    SELECT co.*, c.code, c.name, c.credits,
      (SELECT COUNT(*) FROM enrollments e WHERE e.offering_id = co.id AND e.status='enrolled') AS enrolled_count
    FROM course_offerings co
    JOIN courses c ON c.id = co.course_id
    WHERE co.faculty_id = ? AND co.is_active = 1
  `).all(f.id);
  res.json({ success: true, data: rows });
}));

module.exports = router;
