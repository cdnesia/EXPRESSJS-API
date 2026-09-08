const { z } = require('zod');
const jadwalService = require('../services/jadwal.service');
const AppError = require('../utils/AppError');
const ApiResponse = require('../utils/ApiResponse');

const listBodySchema = z
  .object({
    tahunAkademik: z
      .string()
      .trim()
      .regex(/^\d{4}[12]$/, 'tahunAkademik harus format YYYY1 (ganjil) atau YYYY2 (genap), contoh 20241'),
  })
  .strict();

function parseOrThrow(schema, query) {
  const result = schema.safeParse(query);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new AppError(400, message);
  }
  return result.data;
}

async function list(req, res, next) {
  try {
    const { tahunAkademik } = parseOrThrow(listBodySchema, req.body);
    const jadwal = await jadwalService.findByTahunAkademik(tahunAkademik);
    ApiResponse.success(res, { data: jadwal, message: 'Berhasil mengambil data jadwal perkuliahan.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
