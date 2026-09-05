const { z } = require('zod');
const tagihanService = require('../services/tagihan.service');
const AppError = require('../utils/AppError');
const ApiResponse = require('../utils/ApiResponse');

const JENIS_TAGIHAN = ['SPP', 'KKN', 'SIDANG TUGAS AKHIR', 'SEMINAR PROPOSAL', 'PKL', 'PMB'];

const detailItemSchema = z
  .object({
    nominal: z.union([z.string(), z.number()]),
    idBipot: z.union([z.string(), z.number()]),
    namaBipot: z.string().trim().min(1),
  })
  .strict();

const waktuBerakhirSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'waktuBerakhir harus tanggal yang valid, misal 2026-12-31T16:59:59.000Z',
  });

const tahunAkademikSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-zA-Z0-9]+$/, 'tahunAkademik hanya boleh berisi angka dan huruf');

const createTagihanSchema = z
  .object({
    npm: z.string().trim().min(1).max(30),
    tahunAkademik: tahunAkademikSchema,
    waktuBerakhir: waktuBerakhirSchema,
    detailTagihan: z.array(detailItemSchema).min(1, 'detailTagihan minimal 1 item'),
    detailPotongan: z.array(detailItemSchema).optional(),
    jenisTagihan: z.enum(JENIS_TAGIHAN).optional(),
    khs: z.number().int().optional(),
  })
  .strict();

const updateTagihanSchema = z
  .object({
    idRecordTagihan: z.string().trim().min(1),
    npm: z.string().trim().min(1).max(30),
    waktuBerakhir: waktuBerakhirSchema.optional(),
    detailTagihan: z.array(detailItemSchema).min(1, 'detailTagihan minimal 1 item').optional(),
    detailPotongan: z.array(detailItemSchema).optional(),
    nominalDitagih: z.union([z.string(), z.number()]).optional(),
    jenisTagihan: z.enum(JENIS_TAGIHAN).optional(),
    khs: z.number().int().optional(),
    statusAktif: z.enum(['Y', 'T']).optional(),
  })
  .strict();

// Beda dari tahunAkademikSchema di atas (yang cuma label bebas): endpoint
// SPP otomatis mem-parsing tahunAkademik jadi {tahun}{1|2} untuk menghitung
// semester (lihat bipot.service.js), jadi formatnya wajib ketat.
const createTagihanSppSchema = z
  .object({
    npm: z.string().trim().min(1).max(30),
    tahunAkademik: z
      .string()
      .trim()
      .regex(/^\d{4}[12]$/, 'tahunAkademik harus format YYYY1 (ganjil) atau YYYY2 (genap), contoh 20241'),
  })
  .strict();

const cekTagihanSchema = z
  .object({
    npm: z.array(z.string().trim().min(1)).min(1, 'npm minimal 1 item'),
    tahunAkademik: z.array(tahunAkademikSchema).min(1, 'tahunAkademik minimal 1 item'),
    jenisTagihan: z.enum(JENIS_TAGIHAN).optional(),
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

async function create(req, res, next) {
  try {
    const data = parseOrThrow(createTagihanSchema, req.body);
    const tagihan = await tagihanService.createTagihan(data);
    ApiResponse.success(res, { data: tagihan, message: 'Tagihan berhasil dibuat.', statusCode: 201 });
  } catch (err) {
    next(err);
  }
}

async function createSpp(req, res, next) {
  try {
    const data = parseOrThrow(createTagihanSppSchema, req.body);
    const { skipped, tagihan } = await tagihanService.createTagihanSpp(data);

    ApiResponse.success(res, {
      data: tagihan,
      message: skipped
        ? 'Tagihan SPP untuk NPM dan tahun akademik ini sudah ada, dilewati.'
        : 'Tagihan SPP berhasil dibuat.',
      statusCode: skipped ? 200 : 201,
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { idRecordTagihan, npm, ...data } = parseOrThrow(updateTagihanSchema, req.body);
    const tagihan = await tagihanService.updateTagihan(idRecordTagihan, npm, data);
    ApiResponse.success(res, { data: tagihan, message: 'Tagihan berhasil diperbarui.' });
  } catch (err) {
    next(err);
  }
}

async function cek(req, res, next) {
  try {
    const data = parseOrThrow(cekTagihanSchema, req.body);
    const tagihan = await tagihanService.cekTagihan(data);
    ApiResponse.success(res, { data: tagihan, message: 'Berhasil mengambil data tagihan.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, createSpp, update, cek };
