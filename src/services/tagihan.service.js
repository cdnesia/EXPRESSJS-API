const crypto = require('crypto');
const { getPool } = require('../config/db');
const AppError = require('../utils/AppError');
const mahasiswaService = require('./mahasiswa.service');
const bipotService = require('./bipot.service');

const JENIS_TAGIHAN_DEFAULT = 'SPP';

function generateNomorTagihan(tahunAkademik, vaCode) {
  const kodeDepan = tahunAkademik.slice(-3);
  const ekor = String(vaCode).replace(/\D/g, '').padStart(6, '0');
  return `${kodeDepan}${ekor}`;
}

async function generateIdRecordTagihan(pool) {
  while (true) {
    const now = new Date();
    const year = now.getFullYear();
    const hhmmss = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => String(n).padStart(2, '0'))
      .join('');
    const random5 = crypto.randomInt(0, 100000).toString().padStart(5, '0');
    const candidate = `${year}-${hhmmss}${random5}`;

    const [rows] = await pool.query(
      'SELECT 1 FROM tagihan WHERE id_record_tagihan = ? LIMIT 1',
      [candidate]
    );

    if (rows.length === 0) {
      return candidate;
    }
  }
}

function sumNominal(items) {
  return (items || []).reduce((sum, item) => sum + Number(item.nominal), 0);
}

async function assertNotDuplicate(pool, { npm, tahunAkademik, jenisTagihan }) {
  const [rows] = await pool.query(
    `SELECT id FROM tagihan
     WHERE npm = ? AND tahun_akademik = ? AND jenis_tagihan = ? AND deleted_at IS NULL
     LIMIT 1`,
    [npm, tahunAkademik, jenisTagihan]
  );

  if (rows.length > 0) {
    throw new AppError(
      409,
      `Tagihan untuk npm "${npm}", tahun akademik "${tahunAkademik}", jenis "${jenisTagihan}" sudah ada`
    );
  }
}

async function createTagihan(data) {
  const pool = getPool('PAYMENT');

  const mahasiswa = await mahasiswaService.findByNpm(data.npm);
  const jenisTagihan = data.jenisTagihan || JENIS_TAGIHAN_DEFAULT;

  await assertNotDuplicate(pool, { npm: mahasiswa.npm, tahunAkademik: data.tahunAkademik, jenisTagihan });

  const idRecordTagihan = await generateIdRecordTagihan(pool);
  const nomorTagihan = generateNomorTagihan(data.tahunAkademik, mahasiswa.vaCode);

  const totalTagihan = sumNominal(data.detailTagihan);
  const totalPotongan = sumNominal(data.detailPotongan);
  const nominalDitagih = totalTagihan - totalPotongan;

  if (nominalDitagih < 0) {
    throw new AppError(400, 'Total potongan tidak boleh lebih besar dari total tagihan');
  }

  const [result] = await pool.execute(
    `INSERT INTO tagihan (
      id_record_tagihan, nomor_tagihan, npm, nama_mahasiswa, nama_fakultas,
      kode_program_studi, nama_program_studi, id_kelas_perkuliahan, nama_kelas_perkuliahan,
      tahun_akademik, waktu_berakhir, detail_tagihan, total_tagihan,
      detail_potongan, total_potongan, nominal_ditagih, nominal_terbayar,
      jenis_tagihan, status_aktif, khs
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      idRecordTagihan,
      nomorTagihan,
      mahasiswa.npm,
      mahasiswa.namaMahasiswa,
      mahasiswa.namaFakultas,
      mahasiswa.kodeProgramStudi,
      mahasiswa.namaProgramStudi,
      mahasiswa.idKelasPerkuliahan,
      mahasiswa.namaKelasPerkuliahan || null,
      data.tahunAkademik,
      new Date(data.waktuBerakhir),
      JSON.stringify(data.detailTagihan),
      totalTagihan.toFixed(2),
      data.detailPotongan ? JSON.stringify(data.detailPotongan) : null,
      totalPotongan.toFixed(2),
      nominalDitagih.toFixed(2),
      '0.00',
      jenisTagihan,
      'Y',
      data.khs ?? 0,
    ]
  );

  const [rows] = await pool.query('SELECT * FROM tagihan WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function getByIdRecordTagihan(pool, idRecordTagihan) {
  const [rows] = await pool.query(
    'SELECT * FROM tagihan WHERE id_record_tagihan = ? AND deleted_at IS NULL LIMIT 1',
    [idRecordTagihan]
  );

  if (rows.length === 0) {
    throw new AppError(404, `Tagihan dengan id_record_tagihan "${idRecordTagihan}" tidak ditemukan`);
  }

  return rows[0];
}

async function getForUpdate(pool, idRecordTagihan, npm) {
  const [rows] = await pool.query(
    'SELECT * FROM tagihan WHERE id_record_tagihan = ? AND npm = ? AND deleted_at IS NULL LIMIT 1',
    [idRecordTagihan, npm]
  );

  if (rows.length === 0) {
    throw new AppError(
      404,
      `Tagihan dengan id_record_tagihan "${idRecordTagihan}" dan npm "${npm}" tidak ditemukan`
    );
  }

  return rows[0];
}

async function updateTagihan(idRecordTagihan, npm, data) {
  const pool = getPool('PAYMENT');
  const existing = await getForUpdate(pool, idRecordTagihan, npm);

  const detailTagihan = data.detailTagihan ?? existing.detail_tagihan;
  const detailPotongan = data.detailPotongan !== undefined ? data.detailPotongan : existing.detail_potongan;
  const waktuBerakhir = data.waktuBerakhir ? new Date(data.waktuBerakhir) : existing.waktu_berakhir;
  const jenisTagihan = data.jenisTagihan ?? existing.jenis_tagihan;
  const khs = data.khs ?? existing.khs;
  const statusAktif = data.statusAktif ?? existing.status_aktif;

  if (jenisTagihan !== existing.jenis_tagihan) {
    const [rows] = await pool.query(
      `SELECT id FROM tagihan
       WHERE npm = ? AND tahun_akademik = ? AND jenis_tagihan = ? AND deleted_at IS NULL AND id != ?
       LIMIT 1`,
      [existing.npm, existing.tahun_akademik, jenisTagihan, existing.id]
    );
    if (rows.length > 0) {
      throw new AppError(
        409,
        `Tagihan untuk npm "${existing.npm}", tahun akademik "${existing.tahun_akademik}", jenis "${jenisTagihan}" sudah ada`
      );
    }
  }

  const totalTagihan = sumNominal(detailTagihan);
  const totalPotongan = sumNominal(detailPotongan);
  const nominalDitagih =
    data.nominalDitagih !== undefined ? Number(data.nominalDitagih) : totalTagihan - totalPotongan;

  if (nominalDitagih < 0) {
    throw new AppError(
      400,
      data.nominalDitagih !== undefined
        ? 'nominalDitagih tidak boleh negatif'
        : 'Total potongan tidak boleh lebih besar dari total tagihan'
    );
  }

  await pool.execute(
    `UPDATE tagihan SET
      waktu_berakhir = ?, detail_tagihan = ?, total_tagihan = ?,
      detail_potongan = ?, total_potongan = ?, nominal_ditagih = ?,
      jenis_tagihan = ?, status_aktif = ?, khs = ?
     WHERE id_record_tagihan = ?`,
    [
      waktuBerakhir,
      JSON.stringify(detailTagihan),
      totalTagihan.toFixed(2),
      detailPotongan ? JSON.stringify(detailPotongan) : null,
      totalPotongan.toFixed(2),
      nominalDitagih.toFixed(2),
      jenisTagihan,
      statusAktif,
      khs,
      idRecordTagihan,
    ]
  );

  return getByIdRecordTagihan(pool, idRecordTagihan);
}

async function findExistingSpp(pool, npm, tahunAkademik) {
  const [rows] = await pool.query(
    `SELECT * FROM tagihan
     WHERE npm = ? AND tahun_akademik = ? AND jenis_tagihan = 'SPP' AND deleted_at IS NULL
     LIMIT 1`,
    [npm, tahunAkademik]
  );

  return rows[0] || null;
}

// Buat tagihan SPP otomatis dari rincian tarif bipot (prodi + angkatan +
// kelas kuliah + jalur masuk mahasiswa) — client hanya kirim npm +
// tahunAkademik, sisanya (mahasiswa, tarif, total) dihitung dari data
// SIADE/SIMAKU. Idempoten: kalau tagihan SPP untuk npm+tahunAkademik ini
// sudah ada, dikembalikan apa adanya (skipped) alih-alih membuat duplikat.
async function createTagihanSpp({ npm, tahunAkademik }) {
  const pool = getPool('PAYMENT');
  const mahasiswa = await mahasiswaService.findByNpm(npm);

  const existing = await findExistingSpp(pool, mahasiswa.npm, tahunAkademik);
  if (existing) {
    return { skipped: true, tagihan: existing };
  }

  const { detailTagihan, detailPotongan } = await bipotService.getRincianBiayaMahasiswa({
    npm: mahasiswa.npm,
    tahunAkademik,
  });

  const waktuBerakhir = new Date();
  waktuBerakhir.setFullYear(waktuBerakhir.getFullYear() + 1);

  const tagihan = await createTagihan({
    npm: mahasiswa.npm,
    tahunAkademik,
    waktuBerakhir: waktuBerakhir.toISOString(),
    detailTagihan,
    detailPotongan: detailPotongan.length ? detailPotongan : undefined,
    jenisTagihan: 'SPP',
  });

  return { skipped: false, tagihan };
}

async function cekTagihan({ npm, tahunAkademik, jenisTagihan }) {
  const pool = getPool('PAYMENT');

  const conditions = ['npm IN (?)', 'tahun_akademik = ?', 'deleted_at IS NULL'];
  const params = [npm, tahunAkademik];

  if (jenisTagihan) {
    conditions.push('jenis_tagihan = ?');
    params.push(jenisTagihan);
  }

  const [rows] = await pool.query(
    `SELECT * FROM tagihan WHERE ${conditions.join(' AND ')} ORDER BY npm, jenis_tagihan`,
    params
  );

  return rows;
}

module.exports = { createTagihan, createTagihanSpp, updateTagihan, cekTagihan };
