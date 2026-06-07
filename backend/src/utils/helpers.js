const { v4: uuidv4 } = require('uuid');

const receiptNo = () => 'RCT-' + Date.now().toString(36).toUpperCase() + '-' + uuidv4().slice(0, 6).toUpperCase();

const pad = (n, w = 2) => String(n).padStart(w, '0');

const todayISO = () => new Date().toISOString().slice(0, 10);

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

const isValidDate = (d) => !d || !isNaN(Date.parse(d));

const gradeLetter = (pct) => {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
};

const gpa = (pct) => {
  if (pct >= 90) return 10;
  if (pct >= 80) return 9;
  if (pct >= 70) return 8;
  if (pct >= 60) return 7;
  if (pct >= 50) return 6;
  if (pct >= 40) return 5;
  return 0;
};

const paginate = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

const buildPageResponse = (rows, total, page, pageSize) => ({
  items: rows,
  page,
  pageSize,
  total,
  totalPages: Math.ceil(total / pageSize)
});

const safe = (v) => v == null ? null : v;

module.exports = { receiptNo, pad, todayISO, isValidEmail, isValidDate, gradeLetter, gpa, paginate, buildPageResponse, safe };
