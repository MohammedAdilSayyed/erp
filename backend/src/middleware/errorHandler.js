class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message }
    });
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Invalid JSON payload' }
    });
  }

  // express-validator — array of errors attached to the request, or thrown
  // as an array on a 4xx in newer versions. Be defensive and accept either.
  const validationErrors = Array.isArray(err) ? err
    : (err && Array.isArray(err.errors) ? err.errors : null);
  if (validationErrors && validationErrors.length) {
    const messages = validationErrors.map(e => (e && (e.msg || e.message)) || 'Invalid value').filter(Boolean);
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION', message: messages.join('; ') || 'Invalid input', details: validationErrors }
    });
  }

  console.error('[UNHANDLED]', err);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` }
  });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Helper: place after express-validator middleware arrays to convert attached
// validation errors into a proper 400 response. With express-validator v7 the
// middleware attaches errors to the request instead of calling next(err), so
// we check them in a follow-up step.
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array();
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION',
      message: errors.map(e => e.msg).filter(Boolean).join('; ') || 'Invalid input',
      details: errors
    }
  });
};

module.exports = { AppError, errorHandler, notFound, asyncHandler, validate };
