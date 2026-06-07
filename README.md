# College ERP System

A **production-ready, full-stack college ERP** with role-based access for Admin, Faculty, Student, Librarian, and Accountant. Built with Node.js + Express + SQLite + vanilla JS — no build step, zero-config, ready to run.

## ✨ Features

| Module | Capabilities |
|---|---|
| **Auth** | JWT login, password change, role-based access, audit logging |
| **Dashboard** | KPIs, charts (students by dept/batch), recent activity |
| **Students** | CRUD, profile view, search/filter, paginated |
| **Faculty** | CRUD, profile view, current offerings |
| **Departments** | CRUD |
| **Courses** | CRUD, credit/semester tracking, electives |
| **Course Offerings** | Term-based sections, faculty assignment, schedules, capacity |
| **Enrollments** | Per-student, per-offering, capacity-checked |
| **Attendance** | Daily marking with status, summaries, student history |
| **Assessments & Grades** | Quiz/assignment/midterm/final/lab/project, weighted %, GPA/CGPA |
| **Fee Structures** | Program/batch/semester-based, total computation |
| **Fee Payments** | Multi-mode (cash/card/UPI/bank/online/cheque), receipt generation |
| **Library** | Books catalog, ISBN tracking, circulation, overdue fines (auto) |
| **Hostel** | Hostels, rooms, allocations, vacancy tracking |
| **Notices** | Audience-targeted, priority-based, with expiry |
| **Users** | Admin view, enable/disable accounts |
| **Audit Logs** | Every create/update/delete is logged with user + IP |

## 🛠 Tech Stack

- **Backend**: Node.js, Express, better-sqlite3 (WAL mode, FK enforced)
- **Auth**: JWT (12h expiry) + bcryptjs
- **Security**: Helmet, CORS, express-rate-limit, express-validator
- **Frontend**: Vanilla HTML/CSS/JS, no build step
- **DB**: SQLite (single file, easy to back up)

## 🚀 Quick Start

### Prerequisites
- Node.js **18+** and npm

### Install & Run

```bash
cd backend
npm install
npm run init-db    # creates schema
npm run seed       # loads demo data
npm start          # http://localhost:4000
```

That's it. Open **http://localhost:4000** in your browser.

### Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@college.edu` | `admin123` |
| Faculty | `sarah.johnson@college.edu` | `faculty123` |
| Student | `aarav.sharma@student.college.edu` | `student123` |
| Librarian | `librarian@college.edu` | `lib123` |
| Accountant | `accountant@college.edu` | `acc123` |

All faculty use password `faculty123`; all students use `student123`. Pattern: `firstname.lastname@college.edu` (faculty) or `@student.college.edu` (students).

## 📁 Project Structure

```
erp system/
├── backend/
│   ├── src/
│   │   ├── server.js              # Express bootstrap
│   │   ├── routes/                # auth, academics, attendanceGrades, fees, library, hostel, notices, dashboard, users
│   │   ├── middleware/            # auth, errorHandler, audit
│   │   ├── db/                    # connection, schema.sql, init, seed
│   │   └── utils/                 # helpers (receiptNo, paginate, gradeLetter, gpa)
│   ├── data/                      # SQLite DB lives here (gitignored)
│   ├── .env                       # config (PORT, JWT_SECRET, DB_PATH)
│   └── package.json
├── frontend/
│   ├── index.html                 # SPA shell
│   ├── css/styles.css             # design system
│   └── js/
│       ├── api.js                 # fetch wrapper + auth
│       ├── ui.js                  # toasts, modal, paginator, formatters
│       ├── pages.js               # all module renderers
│       └── app.js                 # router, role-based nav, auth state
├── scripts/
│   ├── start-dev.sh               # Linux/macOS dev starter
│   ├── start-dev.bat              # Windows dev starter
│   └── backup.sh                  # DB backup helper
├── docs/
│   ├── API.md                     # full API reference
│   └── DEPLOYMENT.md              # production deployment guide
└── README.md
```

## 🔐 Security

- Passwords hashed with **bcrypt** (10 rounds)
- JWTs signed with `JWT_SECRET` from `.env` — **change the default in production**
- All mutating endpoints require auth + role check
- `helmet` headers + rate limit (300 req / 15 min default)
- Audit log captures user, action, resource, IP, details
- Parameterized SQL via `better-sqlite3` prepared statements — **no SQL injection**

## ⚙️ Environment Variables (`.env`)

```ini
NODE_ENV=production
PORT=4000
JWT_SECRET=<CHANGE_ME>
JWT_EXPIRES_IN=12h
DB_PATH=./data/erp.db
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
```

## 📦 Production Deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for:
- systemd / PM2 process management
- nginx reverse proxy + TLS
- Docker
- Backup strategy
- Monitoring

## 📚 API

See **[docs/API.md](docs/API.md)** for the complete endpoint reference with examples.

## 🧪 Testing the API

A Postman/Insomnia collection equivalent (curl examples):

```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@college.edu","password":"admin123"}'

# Use the token
TOKEN=...

# List students
curl http://localhost:4000/api/students -H "Authorization: Bearer $TOKEN"

# Dashboard
curl http://localhost:4000/api/dashboard/stats -H "Authorization: Bearer $TOKEN"
```

## 📜 License

MIT
