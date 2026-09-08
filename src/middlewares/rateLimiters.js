const rateLimit = require('express-rate-limit');

const whitelistedIps = (process.env.RATE_LIMIT_WHITELIST_IPS || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

const skip = (req) => whitelistedIps.includes(req.ip);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Terlalu banyak request, coba lagi nanti.', data: null },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Terlalu banyak percobaan, coba lagi nanti.', data: null },
});

module.exports = { apiLimiter, authLimiter };
