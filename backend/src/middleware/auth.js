const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

const authenticate = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
  try {
    req.user = verifyToken(token);
    next();
  } catch (e) {
    return next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
  }
  next();
};

const optionalAuth = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    try { req.user = verifyToken(token); } catch (_) { /* ignore */ }
  }
  next();
};

module.exports = { signToken, verifyToken, authenticate, authorize, optionalAuth };
