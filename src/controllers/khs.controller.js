const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const { z } = require('zod');
const akademikService = require('../services/akademik.service');
const AppError = require('../utils/AppError');
const { renderHtmlToPdf } = require('../utils/pdf');

const TEMPLATE_PATH = path.join(__dirname, '../views/pdf/khs.ejs');
const LOGO_PATH = path.join(__dirname, '../../public/assets/images/favicon-32x32.png');

const cetakKhsSchema = z
  .object({
    npm: z.string().trim().min(1).max(20),
    periode: z
      .string()
      .trim()
      .regex(/^\d{4}[12]$/, 'Format periode tidak valid. Gunakan format YYYY1 (Ganjil) atau YYYY2 (Genap), contoh: 20241.'),
    view: z.enum(['inline', 'download']).optional(),
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

// Font judul fakultas mengecil seiring panjang nama, biar tetap muat satu baris.
function fakultasFontSize(nama) {
  const len = nama.length;
  if (len <= 25) return '24px';
  if (len <= 40) return '22px';
  if (len <= 50) return '20px';
  return '22px';
}

function tahunAkademikLabel(periode) {
  const tahun = Number(periode.slice(0, 4));
  const sem = Number(periode.slice(-1));
  return `${tahun}/${tahun + 1} ${sem % 2 === 0 ? 'Genap' : 'Ganjil'}`;
}

function getLogoDataUri() {
  try {
    const buffer = fs.readFileSync(LOGO_PATH);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

async function cetak(req, res, next) {
  try {
    const { npm, periode, view = 'download' } = parseOrThrow(cetakKhsSchema, req.body);

    const [saya, krs] = await Promise.all([akademikService.getStudent(npm), akademikService.getKhs(npm, periode)]);

    const html = await ejs.renderFile(TEMPLATE_PATH, {
      saya,
      krs,
      periode,
      tahunAkademikLabel: tahunAkademikLabel(periode),
      fakultasFontSize: fakultasFontSize(saya.namaFakultas),
      logoDataUri: getLogoDataUri(),
      tanggal: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()),
    });

    const pdfBuffer = await renderHtmlToPdf(html);

    // npm bebas karakter dari sisi validasi, jadi disaring dulu sebelum
    // masuk ke header Content-Disposition (periode sudah pasti \d{4}[12]).
    const safeNpm = npm.replace(/[^a-zA-Z0-9_-]/g, '') || 'npm';
    const filename = `KHS_${safeNpm}_${periode}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${view === 'inline' ? 'inline' : 'attachment'}; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { cetak };
