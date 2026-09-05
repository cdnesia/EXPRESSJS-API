const { z } = require('zod');
const pegawaiService = require('../services/pegawai.service');
const AppError = require('../utils/AppError');
const ApiResponse = require('../utils/ApiResponse');

const cekPegawaiSchema = z
  .object({
    nik: z.string().trim().min(1).optional(),
    nidn: z.string().trim().min(1).optional(),
    id: z.union([z.string(), z.number()]).optional(),
  })
  .strict()
  .refine((data) => data.nik || data.nidn || data.id, {
    message: 'Salah satu dari nik, nidn, atau id harus diisi',
  });

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

async function list(req, res, next) {
  try {
    const pegawai = await pegawaiService.findAll();
    ApiResponse.success(res, { data: pegawai, message: 'Berhasil mengambil data pegawai.' });
  } catch (err) {
    next(err);
  }
}

async function cek(req, res, next) {
  try {
    const data = parseOrThrow(cekPegawaiSchema, req.body);
    const pegawai = await pegawaiService.findByIdentifier(data);
    ApiResponse.success(res, { data: pegawai, message: 'Berhasil mengambil data pegawai.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, cek };
