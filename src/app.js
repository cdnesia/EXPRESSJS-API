const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middlewares/rateLimiters');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const requestLogger = require('./middlewares/requestLogger');
const AppError = require('./utils/AppError');

const app = express();

// Traefik is the only thing that can reach this container (see
// docker-compose.yml — no port is published directly, only routed through
// the `proxy` network), so it's exactly one hop away: trusting it here is
// what makes req.ip resolve to the real client IP from X-Forwarded-For
// instead of Traefik's own address.
app.set('trust proxy', 1);

// These three must run before anything that can reject a request (CORS,
// Content-Type check, JSON parsing) — otherwise an early rejection would
// skip straight to the error handler via next(err) and bypass logging
// entirely. Attaching here first guarantees every request is captured,
// success or failure.

// Capture each response's success/error message so it can be included in
// the logs below — neither morgan nor a raw status code sees the JSON
// body content on its own.
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // errorHandler pre-fills this with the real error (stack incl.) for a
    // 500 before calling res.json, so the client-facing generic message
    // doesn't overwrite it here — the log must keep the actual cause.
    if (res.locals.logMessage === undefined) {
      res.locals.logMessage = body && (body.error || body.message);
    }
    return originalJson(body);
  };
  next();
});

morgan.token('client', (req) => (req.clientId ? `client:${req.clientId}` : req.ip));
morgan.token('message', (req, res) => res.locals.logMessage || '-');

const logFormat =
  env.nodeEnv === 'development'
    ? ':client :method :url :status :message - :response-time ms'
    : '[:date[iso]] :client :method :url :status :message :res[content-length] - :response-time ms';

app.use(morgan(logFormat));
app.use(requestLogger);

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new AppError(403, 'Not allowed by CORS'));
    },
    credentials: true,
  })
);

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
app.use((req, res, next) => {
  if (BODY_METHODS.has(req.method) && !req.is('application/json')) {
    return next(new AppError(415, 'Content-Type harus application/json'));
  }
  next();
});

app.use(express.json({ limit: '10kb' }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return next(new AppError(400, 'Malformed JSON body'));
  }
  next(err);
});

app.use('/api/v1', apiLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
