const jwt = require('jsonwebtoken');

/**
 * Middleware: Verifies the JWT from the Authorization header.
 * On success, attaches the decoded payload to req.user.
 */
function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, iat, exp }
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized: Token is invalid or expired.' });
  }
}

/**
 * Middleware factory: Restricts access to users with specific roles.
 * Usage: router.get('/admin', protect, authorize('ADMIN'), handler)
 * @param {...string} roles
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        message: `Forbidden: Requires one of the following roles: ${roles.join(', ')}.`,
      });
    }
    next();
  };
}

module.exports = { protect, authorize };
