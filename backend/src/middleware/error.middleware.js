/**
 * Global Express error handler.
 * Must be registered LAST in server.js (after all routes).
 */
function errorHandler(err, _req, res, _next) {
  console.error('[ERROR]', err.message);

  // Prisma known errors
  if (err.code === 'P2002') {
    return res.status(409).json({ message: 'A record with this value already exists.' });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    ...(err.details && { errors: err.details }),
    ...(err.current && { current: err.current }),
  });
}

module.exports = { errorHandler };
