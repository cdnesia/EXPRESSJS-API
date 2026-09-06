const prisma = require('../config/prisma');

// Persists every request (success and failure, every route) to the
// request_logs table — the console log via morgan doesn't survive a
// restart and isn't queryable. A DB write failure here must never break
// the actual request, so it's fire-and-forget with its own catch.
function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    prisma.requestLog
      .create({
        data: {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          message: res.locals.logMessage || null,
          clientId: req.clientId ?? null,
          // req.hostname / req.ip resolve to the real client host/IP (not
          // Traefik's) because `trust proxy` is set in app.js.
          host: req.hostname,
          referer: req.get('referer') || req.get('origin') || null,
          ip: req.ip,
          responseTimeMs: Date.now() - startedAt,
        },
      })
      .catch((err) => {
        console.error('Failed to write request log:', err);
      });
  });

  next();
}

module.exports = requestLogger;
