const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signAccessToken(clientId, name, scopes = []) {
  return jwt.sign(
    { sub: clientId, name, scope: scopes.join(' '), jti: crypto.randomUUID() },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn }
  );
}

// `jti` is caller-supplied (not generated here) so the caller can persist
// the same value to the DB as the client's current-valid-refresh-token
// marker before/alongside signing — see auth.service.js. Unlike the access
// token, the refresh token IS checked against the DB on every use (it's
// only used at refresh time, not on every request, so that cost is cheap).
function signRefreshToken(clientId, jti) {
  return jwt.sign({ sub: clientId, jti }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

function getExpiresIn(token) {
  const { exp } = jwt.decode(token);
  return exp - Math.floor(Date.now() / 1000);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getExpiresIn,
};
