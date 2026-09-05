const env = require('../config/env');
const ApiResponse = require('../utils/ApiResponse');

function notFoundHandler(req, res) {
  ApiResponse.error(res, { message: 'Route tidak ditemukan.', statusCode: 404 });
}

// Centralized error handler: known AppErrors return their own status/message,
// anything else is logged and reported as a generic 500 so internals
// (stack traces, DB errors, etc.) never leak to the client.
function errorHandler(err, req, res, next) {
  const statusCode = err.isOperational ? err.statusCode : 500;
  const message = err.isOperational ? err.message : 'Terjadi kesalahan pada server.';

  if (!err.isOperational) {
    console.error(err);
  }

  ApiResponse.error(res, {
    message,
    statusCode,
    data: env.nodeEnv === 'development' && !err.isOperational ? { stack: err.stack } : null,
  });
}

module.exports = { notFoundHandler, errorHandler };
