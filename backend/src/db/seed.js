// Wipe and reload demo data. Wraps everything in a single transaction so the
// seed is atomic. The temp passwords printed at the end are the same ones
// stored in the demo accounts (admin123, faculty123, student123, lib123,
// acc123) — see README.md for the full list.
const bcrypt = require('bcryptjs');
const db = require('./connection');

console.log('Seeding database…');
const hash = (pwd) => bcrypt.hashSync(pwd, 10);

const seed = db.transaction(() => {
  db.exec(`
    DELETE FROM grades;
    DELETE FROM assessments;
    DELETE FROM attendance;
    DELETE FROM enrollments;
    DELETE FROM course_offerings;
    DELETE FROM courses;
    DELETE FROM fee_payments;
    DELETE FROM fee_structures;
    DELETE FROM book_issues;
    DELETE FROM books;
    DELETE FROM hostel_allocations;
    DELETE FROM rooms;
    DELETE FROM hostels;
    DELETE FROM students;
    DELETE FROM faculty;
    DELETE FROM departments;
    DELETE FROM users;
    DELETE FROM notices;
    DELETE FROM audit_logs;
    DELETE FROM sqlite_sequence;
  `);

  const deptIns = db.prepare('INSERT INTO departments (code, name, head) VALUES (?, ?, ?)');
  const depts = [
    ['CSE', 'Computer Science & Engineering', 'Dr. Alan Turing'],
    ['ECE', 'Electronics & Communication', 'Dr. Hedy Lamarr'],
    ['MECH', 'Mechanical Engineering', 'Dr. Nikola Tesla'],
    ['CIVIL', 'Civil Engineering', 'Dr. M. Visvesvaraya'],
    ['MBA', 'Master of Business Administration', 'Dr. Peter Drucker']
  ];
  const deptIds = {};
  for (const [code, name, head] of depts) {
    const r = deptIns.run(code, name, head);
    deptIds[code] = r.lastInsertRowid;
  }

  const userIns = db.prepare(`
    INSERT INTO users (email, password_hash, role, must_change_password)
    VALUES (?, ?, ?, 0)
  `);
  const adminId  = userIns.run('admin@college.edu',     hash('admin123'),   'admin').lastInsertRowid;
  const libId    = userIns.run('librarian@college.edu', hash('lib123'),     'librarian').lastInsertRowid;
  const accId    = userIns.run('accountant@college.edu',hash('acc123'),     'accountant').lastInsertRowid;

  const facIns = db.prepare(`
    INSERT INTO faculty (user_id, employee_id, first_name, last_name, phone, designation, qualification, department_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const facData = [
    ['EMP001', 'Sarah',    'Johnson',   '+1-555-0101', 'Professor',            'PhD Computer Science', 'CSE'],
    ['EMP002', 'Rajesh',   'Kumar',     '+1-555-0102', 'Associate Professor',  'PhD Algorithms',       'CSE'],
    ['EMP003', 'Emily',    'Chen',      '+1-555-0103', 'Assistant Professor',  'MS Machine Learning',  'CSE'],
    ['EMP004', 'Michael',  'Brown',     '+1-555-0104', 'Professor',            'PhD VLSI Design',      'ECE'],
    ['EMP005', 'Priya',    'Sharma',    '+1-555-0105', 'Associate Professor',  'PhD Signal Processing','ECE'],
    ['EMP006', 'David',    'Wilson',    '+1-555-0106', 'Professor',            'PhD Thermodynamics',   'MECH'],
    ['EMP007', 'Anita',    'Patel',     '+1-555-0107', 'Assistant Professor',  'MS Structural Eng.',   'CIVIL'],
    ['EMP008', 'James',    'Anderson',  '+1-555-0108', 'Professor',            'PhD Marketing',        'MBA']
  ];
  const facIds = {};
  for (const [empId, fn, ln, phone, des, qual, deptCode] of facData) {
    const u = userIns.run(`${fn.toLowerCase()}.${ln.toLowerCase()}@college.edu`, hash('faculty123'), 'faculty');
    const f = facIns.run(u.lastInsertRowid, empId, fn, ln, phone, des, qual, deptIds[deptCode]);
    facIds[empId] = f.lastInsertRowid;
  }

  const stuIns = db.prepare(`
    INSERT INTO students (user_id, roll_no, first_name, last_name, dob, gender, phone, address, city, state, pincode,
      guardian_name, guardian_phone, department_id, program, batch_year, current_semester, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);
  const stuData = [
    ['CS2024-001', 'Aarav',     'Sharma',   '2004-05-12', 'Male',   '+1-555-1001', '123 Oak St',   'Springfield', 'IL', '62701', 'Ramesh Sharma',  '+1-555-2001', 'CSE',   'B.Tech CSE',   2024, 2],
    ['CS2024-002', 'Aisha',     'Patel',    '2004-08-23', 'Female', '+1-555-1002', '456 Pine St',  'Springfield', 'IL', '62701', 'Vijay Patel',    '+1-555-2002', 'CSE',   'B.Tech CSE',   2024, 2],
    ['CS2024-003', 'Benjamin',  'Garcia',   '2004-02-15', 'Male',   '+1-555-1003', '789 Elm St',   'Madison',     'WI', '53703', 'Carlos Garcia',  '+1-555-2003', 'CSE',   'B.Tech CSE',   2024, 2],
    ['CS2023-001', 'Chloe',     'Martinez', '2003-11-30', 'Female', '+1-555-1004', '321 Maple Ave','Chicago',     'IL', '60601', 'Maria Martinez', '+1-555-2004', 'CSE',   'B.Tech CSE',   2023, 4],
    ['CS2023-002', 'Daniel',    'Lee',      '2003-07-19', 'Male',   '+1-555-1005', '654 Cedar Rd', 'Chicago',     'IL', '60601', 'Hee Lee',        '+1-555-2005', 'CSE',   'B.Tech CSE',   2023, 4],
    ['EC2024-001', 'Esha',      'Khan',     '2004-04-08', 'Female', '+1-555-1006', '987 Birch Ln', 'Springfield', 'IL', '62701', 'Imran Khan',     '+1-555-2006', 'ECE',   'B.Tech ECE',   2024, 2],
    ['EC2023-001', 'Felix',     'Wright',   '2003-09-25', 'Male',   '+1-555-1007', '147 Walnut Dr','Madison',     'WI', '53703', 'Susan Wright',   '+1-555-2007', 'ECE',   'B.Tech ECE',   2023, 4],
    ['ME2024-001', 'Gabriella', 'Rossi',    '2004-12-03', 'Female', '+1-555-1008', '258 Spruce Ct','Chicago',     'IL', '60601', 'Marco Rossi',    '+1-555-2008', 'MECH',  'B.Tech Mech',  2024, 2],
    ['ME2023-001', 'Hiroshi',   'Tanaka',   '2003-03-17', 'Male',   '+1-555-1009', '369 Ash Blvd', 'Chicago',     'IL', '60601', 'Yuki Tanaka',    '+1-555-2009', 'MECH',  'B.Tech Mech',  2023, 4],
    ['CV2024-001', 'Isabella',  'Anderson', '2004-06-21', 'Female', '+1-555-1010', '741 Poplar Way','Springfield','IL', '62701', 'Robert Anderson','+1-555-2010', 'CIVIL', 'B.Tech Civil', 2024, 2],
    ['MB2024-001', 'Jai',       'Iyer',     '2001-08-14', 'Male',   '+1-555-1011', '852 Beech St', 'Chicago',     'IL', '60601', 'Karthik Iyer',   '+1-555-2011', 'MBA',   'MBA',          2024, 2],
    ['CS2022-001', 'Kavya',     'Reddy',    '2002-10-09', 'Female', '+1-555-1012', '963 Willow Ave','Madison',    'WI', '53703', 'Suresh Reddy',   '+1-555-2012', 'CSE',   'B.Tech CSE',   2022, 6]
  ];
  const stuIds = [];
  for (const [roll, fn, ln, dob, gen, phone, addr, city, st, pin, gN, gP, deptCode, prog, batch, sem] of stuData) {
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@student.college.edu`;
    const u = userIns.run(email, hash('student123'), 'student');
    const s = stuIns.run(u.lastInsertRowid, roll, fn, ln, dob, gen, phone, addr, city, st, pin, gN, gP, deptIds[deptCode], prog, batch, sem);
    stuIds.push(s.lastInsertRowid);
  }

  const courseIns = db.prepare(`
    INSERT INTO courses (code, name, description, credits, department_id, semester, program, is_elective)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const courseData = [
    ['CS201', 'Data Structures & Algorithms', 'Trees, graphs, sorting, dynamic programming', 4, 'CSE',   3, 'B.Tech CSE',   0],
    ['CS202', 'Database Management Systems',  'Relational model, SQL, transactions',         4, 'CSE',   3, 'B.Tech CSE',   0],
    ['CS203', 'Operating Systems',            'Processes, memory, file systems',             4, 'CSE',   4, 'B.Tech CSE',   0],
    ['CS204', 'Computer Networks',            'TCP/IP, routing, application protocols',      3, 'CSE',   4, 'B.Tech CSE',   0],
    ['CS301', 'Machine Learning',             'Supervised and unsupervised learning',         4, 'CSE',   5, 'B.Tech CSE',   0],
    ['CS302', 'Web Technologies',             'HTML, CSS, JS, Node.js, React',               3, 'CSE',   5, 'B.Tech CSE',   0],
    ['EC201', 'Digital Electronics',          'Logic gates, flip-flops, design',             4, 'ECE',   3, 'B.Tech ECE',   0],
    ['EC202', 'Signals & Systems',            'Continuous and discrete signals',             4, 'ECE',   3, 'B.Tech ECE',   0],
    ['ME201', 'Thermodynamics',               'Laws of thermodynamics, cycles',              4, 'MECH',  3, 'B.Tech Mech',  0],
    ['CV201', 'Structural Analysis',          'Beams, trusses, frames',                      4, 'CIVIL', 3, 'B.Tech Civil', 0],
    ['MB201', 'Principles of Management',     'Planning, organizing, leading',               3, 'MBA',   1, 'MBA',          0],
    ['MB202', 'Marketing Management',         '4Ps, segmentation, strategy',                3, 'MBA',   2, 'MBA',          0]
  ];
  const courseIds = {};
  for (const [code, name, desc, cr, deptCode, sem, prog, elective] of courseData) {
    const r = courseIns.run(code, name, desc, cr, deptIds[deptCode], sem, prog, elective);
    courseIds[code] = r.lastInsertRowid;
  }

  const term = '2026-Spring';
  const offIns = db.prepare(`
    INSERT INTO course_offerings (course_id, faculty_id, section, term, academic_year, capacity, room, schedule, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const offeringData = [
    [courseIds['CS201'], facIds['EMP001'], 'A', term, '2025-2026', 60, 'CS-101',  'Mon 09:00-10:30, Wed 09:00-10:30, Fri 09:00-10:30'],
    [courseIds['CS202'], facIds['EMP002'], 'A', term, '2025-2026', 60, 'CS-102',  'Tue 10:00-11:30, Thu 10:00-11:30'],
    [courseIds['CS203'], facIds['EMP001'], 'A', term, '2025-2026', 60, 'CS-103',  'Mon 14:00-15:30, Wed 14:00-15:30'],
    [courseIds['CS301'], facIds['EMP003'], 'A', term, '2025-2026', 40, 'CS-201',  'Tue 14:00-15:30, Thu 14:00-15:30'],
    [courseIds['CS302'], facIds['EMP002'], 'A', term, '2025-2026', 50, 'CS-Lab1', 'Fri 14:00-17:00'],
    [courseIds['EC201'], facIds['EMP004'], 'A', term, '2025-2026', 60, 'EC-101',  'Mon 11:00-12:30, Wed 11:00-12:30'],
    [courseIds['EC202'], facIds['EMP005'], 'A', term, '2025-2026', 60, 'EC-102',  'Tue 09:00-10:30, Thu 09:00-10:30'],
    [courseIds['ME201'], facIds['EMP006'], 'A', term, '2025-2026', 60, 'ME-101',  'Mon 09:00-10:30, Wed 09:00-10:30'],
    [courseIds['CV201'], facIds['EMP007'], 'A', term, '2025-2026', 60, 'CV-101',  'Tue 11:00-12:30, Thu 11:00-12:30'],
    [courseIds['MB201'], facIds['EMP008'], 'A', term, '2025-2026', 60, 'MB-101',  'Mon 16:00-17:30, Wed 16:00-17:30'],
    [courseIds['MB202'], facIds['EMP008'], 'A', term, '2025-2026', 60, 'MB-102',  'Tue 16:00-17:30, Thu 16:00-17:30']
  ];
  const offeringIds = [];
  for (const [cid, fid, sec, t, ay, cap, room, sched] of offeringData) {
    const r = offIns.run(cid, fid, sec, t, ay, cap, room, sched);
    offeringIds.push(r.lastInsertRowid);
  }

  const enrIns = db.prepare(`INSERT INTO enrollments (student_id, offering_id) VALUES (?, ?)`);
  const cseStudents = db.prepare(`SELECT id FROM students WHERE department_id = ?`).all(deptIds['CSE']);
  for (const s of cseStudents) {
    enrIns.run(s.id, offeringIds[0]);
    enrIns.run(s.id, offeringIds[1]);
    enrIns.run(s.id, offeringIds[2]);
  }
  const cseSeniors = db.prepare(`SELECT id FROM students WHERE department_id = ? AND batch_year IN (2022, 2023)`).all(deptIds['CSE']);
  for (const s of cseSeniors) {
    enrIns.run(s.id, offeringIds[3]);
    enrIns.run(s.id, offeringIds[4]);
  }
  const eceStudents = db.prepare(`SELECT id FROM students WHERE department_id = ?`).all(deptIds['ECE']);
  for (const s of eceStudents) {
    enrIns.run(s.id, offeringIds[5]);
    enrIns.run(s.id, offeringIds[6]);
  }
  const mechStudents = db.prepare(`SELECT id FROM students WHERE department_id = ?`).all(deptIds['MECH']);
  for (const s of mechStudents) enrIns.run(s.id, offeringIds[7]);
  const civilStudents = db.prepare(`SELECT id FROM students WHERE department_id = ?`).all(deptIds['CIVIL']);
  for (const s of civilStudents) enrIns.run(s.id, offeringIds[8]);
  const mbaStudents = db.prepare(`SELECT id FROM students WHERE department_id = ?`).all(deptIds['MBA']);
  for (const s of mbaStudents) {
    enrIns.run(s.id, offeringIds[9]);
    enrIns.run(s.id, offeringIds[10]);
  }

  const aIns = db.prepare(`INSERT INTO assessments (offering_id, name, type, max_marks, weight, due_date) VALUES (?, ?, ?, ?, ?, ?)`);
  const cs201offering = offeringIds[0];
  aIns.run(cs201offering, 'Quiz 1',     'quiz',       20,  0.1, '2026-02-15');
  aIns.run(cs201offering, 'Midterm',    'midterm',    50,  0.3, '2026-03-20');
  aIns.run(cs201offering, 'Assignment 1','assignment',30,  0.1, '2026-03-05');
  aIns.run(cs201offering, 'Final Exam', 'final',      100, 0.5, '2026-05-25');

  const cs201Enrollments = db.prepare(`
    SELECT e.id, e.student_id FROM enrollments e
    JOIN course_offerings co ON co.id = e.offering_id
    WHERE co.id = ? AND e.status='enrolled'
  `).all(cs201offering);
  const cs201assessments = db.prepare(`SELECT id, max_marks, weight FROM assessments WHERE offering_id = ?`).all(cs201offering);
  const gradeIns = db.prepare(`INSERT INTO grades (enrollment_id, assessment_id, marks_obtained) VALUES (?, ?, ?)`);
  for (const enr of cs201Enrollments) {
    for (const a of cs201assessments) {
      const pct = 0.55 + Math.random() * 0.45;
      const m = Math.round(a.max_marks * pct * 10) / 10;
      gradeIns.run(enr.id, a.id, m);
    }
  }

  const today = new Date();
  const attIns = db.prepare(`INSERT INTO attendance (enrollment_id, session_date, status, marked_by) VALUES (?, ?, ?, ?)`);
  const cs201EnrList = db.prepare(`SELECT id FROM enrollments WHERE offering_id = ? AND status='enrolled'`).all(cs201offering);
  for (let d = 0; d < 5; d++) {
    const dt = new Date(today); dt.setDate(today.getDate() - (d * 2));
    const ds = dt.toISOString().slice(0, 10);
    for (const e of cs201EnrList) {
      const r = Math.random();
      const status = r < 0.8 ? 'present' : (r < 0.95 ? 'absent' : 'late');
      attIns.run(e.id, ds, status, facIds['EMP001']);
    }
  }

  const fsIns = db.prepare(`
    INSERT INTO fee_structures (name, program, batch_year, semester, tuition_fee, lab_fee, library_fee, hostel_fee, exam_fee, misc_fee, total, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  fsIns.run('B.Tech CSE 2024 - Sem 3',  'B.Tech CSE',   2024, 3, 50000, 5000, 2000, 30000, 1500, 1500, 90000,  '2026-07-31');
  fsIns.run('B.Tech CSE 2023 - Sem 5',  'B.Tech CSE',   2023, 5, 50000, 5000, 2000, 30000, 1500, 1500, 90000,  '2026-07-31');
  fsIns.run('B.Tech ECE 2024 - Sem 3',  'B.Tech ECE',   2024, 3, 48000, 6000, 2000, 30000, 1500, 1500, 89000,  '2026-07-31');
  fsIns.run('B.Tech Mech 2024 - Sem 3', 'B.Tech Mech',  2024, 3, 45000, 7000, 2000, 30000, 1500, 1500, 87000,  '2026-07-31');
  fsIns.run('MBA 2024 - Sem 2',         'MBA',          2024, 2, 75000,    0, 2000, 30000, 1500, 1500, 110000, '2026-07-31');

  const fpIns = db.prepare(`
    INSERT INTO fee_payments (student_id, amount, payment_mode, transaction_id, receipt_no, status, paid_at, remarks)
    VALUES (?, ?, ?, ?, ?, 'success', ?, ?)
  `);
  const tsBase = Date.now();
  const sample = [
    [stuIds[0],  90000,  'online', 'TXN-2026-0001', 'RCT-' + tsBase + '-1', '2026-01-15 10:30:00', 'Semester 3 fees'],
    [stuIds[1],  90000,  'upi',    'UPI-2026-0002', 'RCT-' + tsBase + '-2', '2026-01-18 14:22:00', 'Semester 3 fees'],
    [stuIds[3],  90000,  'bank',   'BNK-2026-0003', 'RCT-' + tsBase + '-3', '2026-01-20 09:15:00', 'Semester 5 fees'],
    [stuIds[4],  45000,  'card',   'CRD-2026-0004', 'RCT-' + tsBase + '-4', '2026-01-22 16:45:00', 'Partial payment'],
    [stuIds[5],  89000,  'online', 'TXN-2026-0005', 'RCT-' + tsBase + '-5', '2026-01-25 11:00:00', 'Semester 3 fees'],
    [stuIds[7],  87000,  'upi',    'UPI-2026-0006', 'RCT-' + tsBase + '-6', '2026-02-01 12:30:00', 'Semester 3 fees'],
    [stuIds[10], 110000, 'bank',   'BNK-2026-0007', 'RCT-' + tsBase + '-7', '2026-02-05 15:00:00', 'MBA Sem 2 fees']
  ];
  for (const p of sample) fpIns.run(...p);

  const bookIns = db.prepare(`
    INSERT INTO books (isbn, title, author, publisher, edition, category, total_copies, available_copies, shelf_location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const books = [
    ['978-0262033848', 'Introduction to Algorithms',                'Thomas H. Cormen',  'MIT Press',         '3rd', 'Computer Science', 5, 5, 'CS-A1'],
    ['978-0132350884', 'Clean Code',                                'Robert C. Martin',  'Prentice Hall',     '1st', 'Computer Science', 3, 3, 'CS-A2'],
    ['978-0201633610', 'Design Patterns',                           'Erich Gamma et al.','Addison-Wesley',    '1st', 'Computer Science', 2, 2, 'CS-A3'],
    ['978-0596007126', 'Head First Design Patterns',                'Eric Freeman',      'O\'Reilly',         '1st', 'Computer Science', 4, 4, 'CS-A4'],
    ['978-0131103627', 'The C Programming Language',                'Brian W. Kernighan','Prentice Hall',     '2nd', 'Computer Science', 6, 6, 'CS-B1'],
    ['978-0321125217', 'Domain-Driven Design',                      'Eric Evans',        'Addison-Wesley',    '1st', 'Computer Science', 2, 2, 'CS-B2'],
    ['978-0134685991', 'Effective Java',                            'Joshua Bloch',      'Addison-Wesley',    '3rd', 'Computer Science', 3, 3, 'CS-B3'],
    ['978-1491950357', 'Refactoring',                               'Martin Fowler',     'Addison-Wesley',    '2nd', 'Computer Science', 2, 2, 'CS-B4'],
    ['978-0070634246', 'Engineering Thermodynamics',                'P.K. Nag',          'McGraw-Hill',       '5th', 'Mechanical',       3, 3, 'ME-A1'],
    ['978-0132451925', 'Mechanics of Materials',                    'James M. Gere',     'Pearson',           '8th', 'Mechanical',       4, 4, 'ME-A2'],
    ['978-0470403531', 'Structural Analysis',                       'R.C. Hibbeler',     'Pearson',           '8th', 'Civil',            3, 3, 'CV-A1'],
    ['978-0131103628', 'Digital Design',                            'M. Morris Mano',    'Pearson',           '5th', 'Electronics',      4, 4, 'EC-A1'],
    ['978-0073380660', 'Linear Algebra and Its Applications',       'David C. Lay',      'Pearson',           '4th', 'Mathematics',      5, 5, 'MA-A1'],
    ['978-0131103629', 'Principles of Marketing',                   'Philip Kotler',     'Pearson',           '17th','Management',       4, 4, 'MB-A1']
  ];
  for (const b of books) bookIns.run(...b);

  const issueIns = db.prepare(`
    INSERT INTO book_issues (book_id, user_id, due_date, status) VALUES (?, ?, ?, 'issued')
  `);
  const stuUsers = db.prepare(`SELECT user_id FROM students LIMIT 4`).all();
  const today2 = new Date();
  const due = new Date(today2); due.setDate(today2.getDate() + 14);
  issueIns.run(1, stuUsers[0].user_id, due.toISOString().slice(0, 10));
  issueIns.run(2, stuUsers[1].user_id, due.toISOString().slice(0, 10));
  issueIns.run(5, stuUsers[2].user_id, due.toISOString().slice(0, 10));

  const hIns = db.prepare(`INSERT INTO hostels (name, type, warden, total_rooms) VALUES (?, ?, ?, ?)`);
  const h1 = hIns.run('Boys Hostel A',  'boys',  'Mr. R. Singh',  50).lastInsertRowid;
  const h2 = hIns.run('Boys Hostel B',  'boys',  'Mr. K. Verma',  40).lastInsertRowid;
  const h3 = hIns.run('Girls Hostel A', 'girls', 'Ms. L. Reddy',  50).lastInsertRowid;

  const rIns = db.prepare(`INSERT INTO rooms (hostel_id, room_no, capacity, occupied) VALUES (?, ?, ?, ?)`);
  for (let i = 1; i <= 30; i++) rIns.run(h1, '1' + String(i).padStart(2, '0'), 2, 0);
  for (let i = 1; i <= 20; i++) rIns.run(h2, '2' + String(i).padStart(2, '0'), 2, 0);
  for (let i = 1; i <= 30; i++) rIns.run(h3, '1' + String(i).padStart(2, '0'), 2, 0);

  const allocIns = db.prepare(`INSERT INTO hostel_allocations (student_id, room_id) VALUES (?, ?)`);
  const rooms = db.prepare(`SELECT id FROM rooms WHERE hostel_id = ? LIMIT ?`).all(h1, 4);
  for (let i = 0; i < 3; i++) allocIns.run(stuIds[i], rooms[i].id);
  const girlsRooms = db.prepare(`SELECT id FROM rooms WHERE hostel_id = ? LIMIT ?`).all(h3, 4);
  allocIns.run(stuIds[1], girlsRooms[0].id);
  allocIns.run(stuIds[3], girlsRooms[1].id);

  const nIns = db.prepare(`
    INSERT INTO notices (title, body, audience, priority, posted_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  nIns.run('Mid-Semester Examinations Schedule Released', 'Mid-semester exams will be held from March 18 to March 28, 2026. Please check your course pages for individual schedules.', 'all',      'high',   adminId);
  nIns.run('Annual Tech Fest "Innovate 2026"',            'Join us for the annual tech fest on April 15-17, 2026. Registrations open now!',                                          'students', 'normal', adminId);
  nIns.run('Library Hours Extended',                      'Starting next week, the library will be open until midnight during exam period.',                                       'all',      'normal', adminId);
  nIns.run('Faculty Meeting',                             'All faculty members are requested to attend the meeting on Friday at 3 PM in the Senate Hall.',                          'faculty',  'normal', adminId);
  nIns.run('Hostel Maintenance Notice',                   'Water supply will be disrupted in Boys Hostel A on Sunday from 9 AM to 1 PM.',                                          'students', 'low',    adminId);
  nIns.run('URGENT: Scholarship Applications Due',        'Last date to apply for merit scholarships is February 28, 2026. No extensions will be granted.',                      'students', 'urgent', adminId);
});

seed();
console.log('✓ Seed complete\n');
console.log('  ── Demo Accounts ──');
console.log('  Admin:      admin@college.edu                    / admin123');
console.log('  Faculty:    sarah.johnson@college.edu            / faculty123');
console.log('  Student:    aarav.sharma@student.college.edu     / student123');
console.log('  Librarian:  librarian@college.edu                / lib123');
console.log('  Accountant: accountant@college.edu               / acc123');
console.log('');

process.exit(0);
