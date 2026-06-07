const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../src/server');

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('health endpoint returns success', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.status, 'ok');
  assert.ok(typeof body.data.users === 'number');
});

test('admin login returns token', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@college.edu', password: 'admin123' })
  });
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.success, true);
  assert.ok(body.data.token);
});

test('login validation returns 400 for invalid email', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: 'admin123' })
  });
  const body = await res.json();
  assert.strictEqual(res.status, 400);
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error.code, 'VALIDATION');
  assert.ok(body.error.message.includes('Valid email required'));
});

test('student creation validation returns 400', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@college.edu', password: 'admin123' })
  });
  const loginBody = await loginRes.json();
  const res = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.data.token}` },
    body: JSON.stringify({ email: 'x' })
  });
  const body = await res.json();
  assert.strictEqual(res.status, 400);
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error.code, 'VALIDATION');
});

test('course creation validation returns 400', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@college.edu', password: 'admin123' })
  });
  const loginBody = await loginRes.json();
  const res = await fetch(`${baseUrl}/api/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.data.token}` },
    body: JSON.stringify({ name: 'Biology' })
  });
  const body = await res.json();
  assert.strictEqual(res.status, 400);
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error.code, 'VALIDATION');
});

test('hostel creation validation returns 400', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@college.edu', password: 'admin123' })
  });
  const loginBody = await loginRes.json();
  const res = await fetch(`${baseUrl}/api/hostels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.data.token}` },
    body: JSON.stringify({})
  });
  const body = await res.json();
  assert.strictEqual(res.status, 400);
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error.code, 'VALIDATION');
});

test('attendance validation catches invalid status', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@college.edu', password: 'admin123' })
  });
  const loginBody = await loginRes.json();
  const res = await fetch(`${baseUrl}/api/attendance/mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.data.token}` },
    body: JSON.stringify({ offeringId: 1, sessionDate: '2026-06-07', records: [{ studentId: 1, status: 'maybe' }] })
  });
  const body = await res.json();
  assert.strictEqual(res.status, 400);
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error.code, 'VALIDATION');
  assert.ok(body.error.message.includes('status must be one of'));
});

test('attendance validation catches invalid date', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@college.edu', password: 'admin123' })
  });
  const loginBody = await loginRes.json();
  const res = await fetch(`${baseUrl}/api/attendance/mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.data.token}` },
    body: JSON.stringify({ offeringId: 1, sessionDate: 'not-a-date', records: [{ studentId: 1, status: 'present' }] })
  });
  const body = await res.json();
  assert.strictEqual(res.status, 400);
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error.code, 'VALIDATION');
});

test('dashboard stats returns counts', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@college.edu', password: 'admin123' })
  });
  const loginBody = await loginRes.json();
  const res = await fetch(`${baseUrl}/api/dashboard/stats`, {
    headers: { Authorization: `Bearer ${loginBody.data.token}` }
  });
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.success, true);
  assert.ok(body.data.counts?.totalStudents >= 0);
});
