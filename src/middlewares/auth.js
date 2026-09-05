const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/jwt');

// Deliberately stateless — no DB lookup per request. An access token that
// was superseded by a newer one (via refresh) stays technically valid
// until its own expiry instead of dying instantly; the JWT_ACCESS_EXPIRES_IN
// window is kept short specifically to bound that exposure, since the
// alternative (checking a DB-backed jti on every request) costs a query
// per authenticated call.
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing or invalid Authorization header'));
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    req.clientId = payload.sub;
    req.scopes = payload.scope ? payload.scope.split(' ').filter(Boolean) : [];
    next();
  } catch (err) {
    next(new AppError(401, 'Invalid or expired access token'));
  }
}

module.exports = requireAuth;
