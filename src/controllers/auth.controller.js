const { z } = require('zod');
const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');
const ApiResponse = require('../utils/ApiResponse');

const loginSchema = z
  .object({
    clientId: z.string().trim().min(1),
    clientSecret: z.string().trim().min(1),
  })
  .strict();

const refreshSchema = z
  .object({
    refreshToken: z.string().trim().min(1),
  })
  .strict();

function parseOrThrow(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new AppError(400, message);
  }
  return result.data;
}

async function login(req, res, next) {
  try {
    const data = parseOrThrow(loginSchema, req.body);
    const result = await authService.login(data);
    ApiResponse.success(res, { data: result, message: 'Login berhasil.' });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const data = parseOrThrow(refreshSchema, req.body);
    const result = await authService.refresh(data.refreshToken);
    ApiResponse.success(res, { data: result, message: 'Token berhasil diperbarui.' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const client = await authService.getById(req.clientId);
    ApiResponse.success(res, { data: client, message: 'Berhasil mengambil data client.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, me };
