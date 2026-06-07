# API Reference

Base URL: `/api`

All responses follow the shape:
```json
{ "success": true, "data": ... }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

Authenticated routes require `Authorization: Bearer <token>` header. Get a token via `/auth/login`.

---

## Auth

### `POST /auth/login`
Body: `{ email, password }` → `{ token, user, profile }`

### `GET /auth/me` (auth)
Returns current user + role-specific profile.

### `POST /auth/change-password` (auth)
Body: `{ currentPassword, newPassword }` (newPassword ≥ 8 chars)

---

## Dashboard

### `GET /dashboard/stats` (auth)
Aggregate counts, finance, attendance, charts, recent activity.

### `GET /dashboard/audit-logs` (admin)
Query: `?page=1&pageSize=50` → audit log entries.

---

## Users (admin)

### `GET /users` (admin)
### `PUT /users/:id/status` (admin) — body `{ isActive: bool }`

---

## Departments

### `GET /departments` (auth)
### `POST /departments` (admin) — `{ code, name, head? }`
### `PUT /departments/:id` (admin)
### `DELETE /departments/:id` (admin)

---

## Students

### `GET /students` (auth)
Query: `q, departmentId, batchYear, status, page, pageSize`

### `GET /students/:id` (auth) — student detail + enrollments + payments
### `POST /students` (admin) — returns `{ tempPassword }`
### `PUT /students/:id` (admin)
### `DELETE /students/:id` (admin)

---

## Faculty

### `GET /faculty` (auth) — same query shape as students
### `GET /faculty/:id` (auth)
### `POST /faculty` (admin)
### `PUT /faculty/:id` (admin)
### `DELETE /faculty/:id` (admin)

---

## Courses

### `GET /courses?departmentId=&semester=&program=&q=`
### `POST /courses` (admin) — `{ code, name, credits, departmentId, semester, program, isElective, description }`
### `PUT /courses/:id` (admin)
### `DELETE /courses/:id` (admin)

---

## Course Offerings

### `GET /offerings?term=&facultyId=&isActive=`
### `POST /offerings` (admin)
### `PUT /offerings/:id` (admin/faculty-of-this-offering)
### `DELETE /offerings/:id` (admin)
### `GET /offerings/:id/roster` (auth) — students enrolled

---

## Enrollments

### `POST /enrollments` (admin) — `{ studentId, offeringId }`
### `DELETE /enrollments/:id` (admin) — soft drop
### `GET /my/enrollments` (student)

---

## My Stuff

### `GET /my/offerings` (faculty)
### `GET /my/enrollments` (student)
### `GET /my/payments` (student)

---

## Attendance

### `POST /attendance/mark` (admin/faculty-of-offering)
```json
{
  "offeringId": 1,
  "sessionDate": "2026-06-07",
  "records": [
    { "studentId": 1, "status": "present", "remarks": "" },
    { "studentId": 2, "status": "absent", "remarks": "sick" }
  ]
}
```
Status: `present | absent | late | excused`

### `GET /attendance/offering/:offeringId?sessionDate=&from=&to=`
### `GET /attendance/summary/offering/:offeringId`
### `GET /attendance/student/:studentId`

---

## Assessments & Grades

### `GET /assessments/offering/:offeringId`
### `POST /assessments` (admin/faculty) — `{ offeringId, name, type, maxMarks, weight, dueDate }`
### `PUT /assessments/:id`
### `DELETE /assessments/:id`

### `POST /grades` (admin/faculty)
```json
{
  "assessmentId": 1,
  "records": [{ "enrollmentId": 5, "marksObtained": 87.5, "remarks": "" }]
}
```

### `GET /grades/offering/:offeringId` — full gradebook with computed final %
### `GET /grades/student/:studentId` — `{ courses, cgpa, totalCredits }`

---

## Fees

### `GET /fee-structures`
### `POST /fee-structures` (admin)
### `DELETE /fee-structures/:id` (admin)

### `GET /payments?studentId=&status=&from=&to=&page=&pageSize=` (admin/accountant)
### `POST /payments` (admin/accountant) — `{ studentId, amount, paymentMode, transactionId, structureId, remarks }`
  Returns receipt no like `RCT-LWTVJK-ABCD12`
### `GET /payments/receipt/:id`
### `GET /fees/student/:studentId/summary` — total paid + per-structure

---

## Library

### `GET /books?q=&category=&page=&pageSize=`
### `POST /books` (admin/librarian) — `{ isbn, title, author, publisher, edition, category, totalCopies, shelfLocation }`
### `PUT /books/:id`
### `DELETE /books/:id`

### `GET /issues?userId=&bookId=&status=&page=&pageSize=` (students see only their own)
### `POST /issues` (admin/librarian) — `{ bookId, userId, days }` (default 14)
### `POST /issues/:id/return` (admin/librarian) — body `{ returnedAt }`; computes fine at $5/day overdue

---

## Hostel (admin)

### `GET /hostels`
### `POST /hostels`
### `GET /hostels/:hostelId/rooms`
### `POST /hostels/:hostelId/rooms`

### `GET /allocations`
### `POST /allocations` — `{ studentId, roomId }`
### `POST /allocations/:id/vacate`

---

## Notices

### `GET /notices?audience=&priority=&page=&pageSize=`
  Audience: `all | students | faculty | staff`
  Priority: `low | normal | high | urgent`
### `POST /notices` (admin) — `{ title, body, audience, priority, expiresAt }`
### `DELETE /notices/:id` (admin)

---

## Health

### `GET /health` (unauthenticated)
Returns `{ status, users, timestamp }`. Suitable for monitoring.

---

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `BAD_REQUEST` / `VALIDATION` | 400 | Malformed input |
| `UNAUTHENTICATED` | 401 | Missing/invalid token |
| `INVALID_TOKEN` | 401 | Token expired or tampered |
| `INVALID_CREDENTIALS` | 401 | Bad email/password |
| `FORBIDDEN` | 403 | Role not permitted |
| `NOT_FOUND` | 404 | Resource missing |
| `CONFLICT` | 409 | Unique constraint (e.g. duplicate roll no) |
| `FULL` | 409 | Capacity reached |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unhandled exception |
