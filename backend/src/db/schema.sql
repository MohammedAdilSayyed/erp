-- ============================================================================
-- COLLEGE ERP SYSTEM - DATABASE SCHEMA
-- Production-ready schema with constraints, indexes, and foreign keys
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- =========================
-- USERS & AUTH
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','faculty','student','librarian','accountant')),
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =========================
-- DEPARTMENTS
-- =========================
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  head TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================
-- STUDENTS
-- =========================
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  roll_no TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob TEXT,
  gender TEXT CHECK (gender IN ('Male','Female','Other')),
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  department_id INTEGER,
  program TEXT,
  batch_year INTEGER,
  current_semester INTEGER DEFAULT 1,
  admission_date TEXT DEFAULT (date('now')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','graduated','dropout')),
  photo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_students_dept ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch_year);

-- =========================
-- FACULTY
-- =========================
CREATE TABLE IF NOT EXISTS faculty (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  designation TEXT,
  qualification TEXT,
  department_id INTEGER,
  join_date TEXT DEFAULT (date('now')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','retired','terminated')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_faculty_dept ON faculty(department_id);

-- =========================
-- COURSES
-- =========================
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL DEFAULT 3,
  department_id INTEGER,
  semester INTEGER,
  program TEXT,
  is_elective INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_courses_dept ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_sem ON courses(semester);

-- =========================
-- OFFERINGS (Course x Section x Term)
-- =========================
CREATE TABLE IF NOT EXISTS course_offerings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  faculty_id INTEGER,
  section TEXT NOT NULL DEFAULT 'A',
  term TEXT NOT NULL,           -- e.g. "2026-Spring"
  academic_year TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 60,
  room TEXT,
  schedule TEXT,                -- e.g. "Mon 10:00-11:00, Wed 10:00-11:00"
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_offerings_term ON course_offerings(term);

-- =========================
-- ENROLLMENTS
-- =========================
CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  offering_id INTEGER NOT NULL,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','dropped','completed')),
  UNIQUE(student_id, offering_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (offering_id) REFERENCES course_offerings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_enroll_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enroll_offering ON enrollments(offering_id);

-- =========================
-- ATTENDANCE
-- =========================
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL,
  session_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  remarks TEXT,
  marked_by INTEGER,
  marked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(enrollment_id, session_date),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(session_date);

-- =========================
-- ASSESSMENTS & GRADES
-- =========================
CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offering_id INTEGER NOT NULL,
  name TEXT NOT NULL,           -- e.g. "Midterm", "Final", "Quiz 1"
  type TEXT NOT NULL CHECK (type IN ('quiz','assignment','midterm','final','project','lab')),
  max_marks REAL NOT NULL DEFAULT 100,
  weight REAL NOT NULL DEFAULT 0.2,  -- weight in final grade
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (offering_id) REFERENCES course_offerings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL,
  assessment_id INTEGER NOT NULL,
  marks_obtained REAL,
  remarks TEXT,
  graded_by INTEGER,
  graded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(enrollment_id, assessment_id),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =========================
-- FEES
-- =========================
CREATE TABLE IF NOT EXISTS fee_structures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,           -- e.g. "B.Tech CSE 2026 Tuition"
  program TEXT,
  batch_year INTEGER,
  semester INTEGER,
  tuition_fee REAL NOT NULL DEFAULT 0,
  lab_fee REAL NOT NULL DEFAULT 0,
  library_fee REAL NOT NULL DEFAULT 0,
  hostel_fee REAL NOT NULL DEFAULT 0,
  exam_fee REAL NOT NULL DEFAULT 0,
  misc_fee REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  structure_id INTEGER,
  amount REAL NOT NULL,
  payment_mode TEXT CHECK (payment_mode IN ('cash','card','upi','bank','online','cheque')),
  transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','pending','failed','refunded')),
  receipt_no TEXT UNIQUE NOT NULL,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  remarks TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (structure_id) REFERENCES fee_structures(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_student ON fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON fee_payments(paid_at);

-- =========================
-- LIBRARY
-- =========================
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn TEXT UNIQUE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT,
  edition TEXT,
  category TEXT,
  total_copies INTEGER NOT NULL DEFAULT 1,
  available_copies INTEGER NOT NULL DEFAULT 1,
  shelf_location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);

CREATE TABLE IF NOT EXISTS book_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,    -- student or faculty user_id
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  due_date TEXT NOT NULL,
  returned_at TEXT,
  fine_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','returned','lost','overdue')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_issues_user ON book_issues(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON book_issues(status);

-- =========================
-- HOSTEL
-- =========================
CREATE TABLE IF NOT EXISTS hostels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('boys','girls')),
  warden TEXT,
  total_rooms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hostel_id INTEGER NOT NULL,
  room_no TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  occupied INTEGER NOT NULL DEFAULT 0,
  UNIQUE(hostel_id, room_no),
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hostel_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  allocated_at TEXT NOT NULL DEFAULT (datetime('now')),
  vacated_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','vacated')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- =========================
-- NOTICES
-- =========================
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','students','faculty','staff')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  posted_by INTEGER,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =========================
-- AUDIT LOG
-- =========================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  resource TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);
