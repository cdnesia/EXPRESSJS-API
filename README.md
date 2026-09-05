# Client Auth API (Express + MySQL + Prisma)

REST API autentikasi bergaya **OAuth2 client-credentials** (`client_id` +
`client_secret`) — cocok untuk API yang dikonsumsi banyak aplikasi/service,
bukan login end-user biasa. Dibangun sederhana tapi tetap mengikuti praktik
keamanan standar industri.

## Struktur Folder

```
src/
  config/        # koneksi database utama (Prisma), database tambahan (db.js) & env vars
  routes/        # definisi endpoint
  controllers/   # validasi input (Zod) -> panggil service -> kirim response
  services/      # business logic (hashing, JWT, query DB)
  middlewares/   # auth, rate limit, error handler
  utils/         # helper (JWT, AppError)
  app.js         # setup Express + middleware
  server.js      # entry point
prisma/
  schema.prisma  # definisi tabel database
```

Alurnya selalu: **Route → Middleware (auth/rate-limit) → Controller (validasi input) → Service → Database**.
Validasi input sengaja diletakkan langsung di controller (pakai Zod), bukan
di file/folder terpisah, supaya alurnya gampang diikuti dalam satu file.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Siapkan database MySQL, lalu isi `DATABASE_URL` di file `.env` (sudah
   dibuatkan dari `.env.example`, secret JWT sudah digenerate otomatis —
   tinggal ganti bagian `DATABASE_URL` dengan kredensial MySQL kamu):
   ```
   DATABASE_URL="mysql://user:password@localhost:3306/auth_db"
   ```

3. Jalankan migration untuk membuat tabel `clients`:
   ```
   npm run prisma:migrate
   ```

4. Jalankan server (mode development, auto-restart):
   ```
   npm run dev
   ```

   Server berjalan di `http://localhost:3000`.

## Endpoint

| Method | Endpoint                | Body                              | Keterangan                     |
|--------|--------------------------|-------------------------------------|----------------------------------|
| GET    | `/api/v1/health`        | -                                    | Cek server & database hidup    |
| POST   | `/api/v1/auth/register` | `name`                              | Daftarkan client baru, dapat `client_id` + `client_secret` |
| POST   | `/api/v1/auth/login`    | `clientId, clientSecret`           | Tukar credentials jadi access token + refresh token |
| POST   | `/api/v1/auth/refresh`  | `refreshToken`                     | Tukar refresh token yang masih valid jadi access token baru |
| GET    | `/api/v1/auth/me`       | Header: `Authorization: Bearer <accessToken>` | Info client yang sedang login |
| POST   | `/api/v1/tagihan/create`       | lihat bagian **Tagihan** di bawah, Header: `Authorization: Bearer <accessToken>` | Buat tagihan baru di database `dev_payment` |
| POST   | `/api/v1/tagihan/update`       | lihat bagian **Tagihan** di bawah, Header: `Authorization: Bearer <accessToken>` | Update tagihan yang sudah ada (key: `idRecordTagihan`) |
| POST   | `/api/v1/tagihan/cek`          | lihat bagian **Tagihan** di bawah, Header: `Authorization: Bearer <accessToken>` | Cek tagihan untuk banyak npm sekaligus |

Semua response mengikuti format konsisten:
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "pesan error" }
```

### Alur pemakaian

1. **Register sekali** untuk tiap aplikasi/service yang akan konsumsi API ini:
   ```
   POST /api/v1/auth/register
   { "name": "Mobile App" }
   ```
   Response berisi `clientId` dan `clientSecret` — **`clientSecret` cuma
   ditampilkan sekali ini saja**, di server hanya tersimpan hash-nya (bcrypt),
   sama seperti password. Simpan baik-baik; kalau hilang, satu-satunya cara
   adalah register client baru (tidak ada endpoint "lihat ulang secret").

2. **Login** pakai credentials tadi untuk dapat sepasang token. `*ExpiresIn`
   dalam satuan detik, diambil langsung dari klaim `exp` token itu sendiri
   (bukan dihitung ulang dari config) supaya selalu akurat:
   ```
   POST /api/v1/auth/login
   { "clientId": "client_xxx", "clientSecret": "xxx" }
   → {
       "accessToken": "...",
       "accessTokenExpiresIn": 900,
       "refreshToken": "...",
       "refreshTokenExpiresIn": 2592000
     }
   ```

3. Pakai `accessToken` di header `Authorization: Bearer <token>` untuk akses
   endpoint yang butuh autentikasi (`GET /me`, dan endpoint lain yang nanti
   ditambahkan).

4. Kalau `accessToken` sudah expired (umur pendek, default 15 menit),
   tukar `refreshToken` (umur lebih panjang, default 30 hari) jadi
   `accessToken` baru tanpa perlu mengirim ulang `client_secret`:
   ```
   POST /api/v1/auth/refresh
   { "refreshToken": "..." }
   → { "accessToken": "...", "accessTokenExpiresIn": 900 }
   ```
   Kalau `refreshToken` juga sudah expired, satu-satunya cara adalah
   `POST /auth/login` lagi pakai `client_id`/`client_secret`.

Tidak ada endpoint `/logout`: kedua token adalah JWT stateless (tidak
disimpan di database), jadi "logout" cukup dilakukan client dengan
membuang token yang tersimpan di sisi client.

Body request divalidasi ketat (`.strict()` di Zod, langsung di controller) —
field yang tidak dikenal (misal menyisipkan `role: "admin"` saat register)
langsung ditolak dengan 400, bukan diam-diam diabaikan.

## Koneksi ke Banyak Database

Database utama (`clients`) dikelola Prisma seperti biasa. Untuk database
tambahan dengan skema/tujuan berbeda (misal logging, reporting, dsb), tinggal
tambahkan satu baris di `.env` — **tidak perlu ubah kode sama sekali**:

```
DATABASE_URL_LOGS="mysql://user:password@localhost:3306/logs_db"
DATABASE_URL_ANALYTICS="mysql://user:password@localhost:3306/analytics_db"
```

Setiap `DATABASE_URL_<NAMA>` otomatis terdaftar dan bisa dipakai di mana saja
lewat `getPool`:

```js
const { getPool } = require('./config/db');

const logsDb = getPool('LOGS'); // baca dari DATABASE_URL_LOGS
const [rows] = await logsDb.query('SELECT * FROM logs WHERE client_id = ?', [clientId]);
```

Selalu pakai placeholder `?` (bukan concat string) supaya tetap aman dari SQL
injection — sama seperti proteksi yang diberikan Prisma untuk database utama.
Panggil `getPool('NAMA_YANG_SALAH')` untuk nama yang belum didaftarkan akan
langsung melempar error yang jelas, bukan gagal diam-diam.

`GET /api/v1/health` otomatis mengecek dan melaporkan status semua database
yang terdaftar (main + semua `DATABASE_URL_*`), berguna untuk monitoring.

## Tagihan (contoh pemakaian database tambahan)

`POST /api/v1/tagihan/create` (butuh `Authorization: Bearer <accessToken>`) — buat
baris baru di tabel `tagihan` pada database `dev_payment` (`DATABASE_URL_PAYMENT`).
Struktur & tipe kolom mengikuti tabel yang sudah ada (bukan bikin skema baru),
diambil dari data yang sudah ada di database saat endpoint ini dibuat.

```
POST /api/v1/tagihan/create
{
  "npm": "21103154251001",
  "tahunAkademik": "20261",              // hanya angka & huruf, tanpa batas panjang
  "waktuBerakhir": "2026-12-31T16:59:59.000Z",
  "detailTagihan": [
    { "nominal": 500000, "idBipot": 1, "namaBipot": "Biaya SPP" }
  ],
  "detailPotongan": [ ... ],             // opsional
  "jenisTagihan": "SPP",                 // opsional, default SPP
  "khs": 0                               // opsional, default 0
}
```

Sebelum insert, server mengecek dulu apakah sudah ada tagihan aktif dengan
kombinasi `npm` + `tahunAkademik` + `jenisTagihan` (setelah default `SPP`
diterapkan) yang sama — kalau sudah ada, ditolak `409` dengan pesan jelas.
Baris yang sudah soft-deleted (`deleted_at` terisi) tidak dihitung, jadi
tidak menghalangi tagihan baru dibuat.

Field yang dihitung/diambil otomatis oleh server (kalau dikirim client,
langsung ditolak 400 karena bukan bagian dari skema input — bukan sekadar
diabaikan diam-diam):
- **`nama_mahasiswa`, `nama_fakultas`, `kode_program_studi`,
  `nama_program_studi`, `id_kelas_perkuliahan`, `nama_kelas_perkuliahan`,
  `va_code`** — diambil dari database akademik `dev_siade_new`
  (`DATABASE_URL_SIADE`) berdasarkan `npm`, lewat `master_mahasiswa` di-join
  ke `master_program_studi`, `master_fakultas`, dan `master_kelas_perkuliahan`
  (lihat [mahasiswa.service.js](src/services/mahasiswa.service.js)). Kalau
  `npm` tidak ditemukan → 404. Kalau ditemukan tapi data akademiknya belum
  lengkap (misal `program_kuliah_id` masih kosong) → 422, bukan gagal mentah
  di database.
- **`id_record_tagihan`** — format `<TAHUN>-<JamMenitDetik><5 digit acak>`
  (misal `2026-22393514760`), di-generate ulang sampai ketemu yang belum
  dipakai. **Catatan: ini beda dari algoritma sistem aslinya** (yang formatnya
  `<TAHUN>-<5 digit acak>` saja, tanpa jam:menit:detik) — sengaja diperpanjang
  atas permintaan eksplisit supaya jauh lebih tahan bentrok, karena butuh
  detik yang sama persis + 5 digit acak yang sama persis untuk bisa collide.
- **`nomor_tagihan`** — `<3 digit terakhir tahunAkademik><va_code mahasiswa,
  angka saja, di-pad nol kiri sampai 6 digit>` (misal `261` + `001049` =
  `261001049`), dikonfirmasi ke pemilik proyek.
- **`total_tagihan`** — jumlah `nominal` di `detailTagihan`.
- **`total_potongan`** — jumlah `nominal` di `detailPotongan` (kalau ada).
- **`nominal_ditagih`** — `total_tagihan - total_potongan`; ditolak (400) kalau hasilnya negatif.
- **`nominal_terbayar`** — selalu `0` untuk tagihan baru (belum dibayar).
- **`status_aktif`** — selalu `'Y'` (aktif/belum lunas) untuk tagihan baru.

**Catatan**: kolom `id_record_tagihan` di tabel `tagihan` **tidak punya unique
constraint** di database (cuma `id` sebagai primary key) — keterbatasan skema
yang sudah ada, bukan sesuatu yang ditambahkan endpoint ini. Generate-nya
mengecek dulu ke database sebelum dipakai (retry sampai unik), tapi tetap ada
celah race condition kecil kalau dua request pas dapat kandidat 5-digit acak
yang sama persis di saat yang sama.

### Update tagihan

`POST /api/v1/tagihan/update` — update parsial, key-nya **kombinasi**
`idRecordTagihan` + `npm` (keduanya wajib, harus milik tagihan yang sama).
Field lain semuanya opsional, yang tidak dikirim tetap pakai nilai lama:

```
POST /api/v1/tagihan/update
{
  "idRecordTagihan": "2026-22583474639",   // wajib
  "npm": "21103154251001",                 // wajib — bukti kepemilikan, bukan untuk diubah
  "detailTagihan": [ ... ],                // opsional
  "detailPotongan": [ ... ],               // opsional
  "nominalDitagih": 123456,                // opsional, lihat catatan di bawah
  "waktuBerakhir": "2027-01-31T16:59:59.000Z", // opsional
  "jenisTagihan": "SPP",                   // opsional
  "khs": 1,                                // opsional
  "statusAktif": "T"                       // opsional, 'Y' atau 'T'
}
```

- `npm` **wajib dikirim** tapi nilainya harus sama dengan npm pemilik
  tagihan tersebut — bukan untuk mengubah kepemilikan, melainkan bukti
  bahwa yang meng-update memang tahu npm mahasiswanya. Kalau `idRecordTagihan`
  ketemu tapi `npm`-nya tidak cocok → tetap `404` (tidak dibedakan dari
  "tidak ditemukan sama sekali", supaya tidak bocorkan info npm mana yang
  valid untuk id_record_tagihan tertentu).
- `tahunAkademik` dan `nomor_tagihan` **tidak bisa diubah** lewat endpoint
  ini (bukan bagian dari skema input, langsung ditolak 400 kalau dikirim)
  — kalau itu yang berubah, seharusnya dibuat tagihan baru.
- Kalau `detailTagihan` dan/atau `detailPotongan` dikirim (salah satu atau
  keduanya), `total_tagihan`/`total_potongan` **selalu** dihitung ulang dari
  hasil gabungan nilai baru + nilai lama yang tidak diubah — jadi tidak akan
  pernah nyimpang dari isi detail-nya.
- `nominal_ditagih` defaultnya juga ikut dihitung ulang otomatis
  (`total_tagihan - total_potongan`). **Tapi kalau `nominalDitagih` dikirim
  eksplisit di body, nilai itu yang dipakai apa adanya** — override hasil
  hitung otomatis (misal untuk kasus nominal_ditagih perlu disesuaikan
  manual di luar logic detail/potongan). Tetap ditolak 400 kalau nilainya
  negatif.
- Kalau `jenisTagihan` diubah, tetap dicek proteksi duplikat yang sama
  seperti saat create (npm + tahunAkademik + jenisTagihan baru tidak boleh
  sudah dipakai tagihan aktif lain).

### Cek tagihan

`POST /api/v1/tagihan/cek` — cek tagihan aktif untuk banyak `npm` sekaligus:

```
POST /api/v1/tagihan/cek
{
  "npm": ["21103154251001", "21103154251002"],  // wajib, array, minimal 1 item, tanpa batas maksimal
  "tahunAkademik": "20261",                       // wajib
  "jenisTagihan": "SPP"                           // opsional — kalau tidak dikirim, semua jenis ikut dicek
}
→ { "success": true, "data": [ { ...baris tagihan yang cocok... } ] }
```

- Balikannya array (bisa kosong `[]`) — bukan 404, karena npm yang belum
  punya tagihan itu wajar, bukan error. Npm yang tidak muncul di hasil
  berarti belum punya tagihan untuk kombinasi tahunAkademik/jenisTagihan itu.
- Baris yang sudah soft-deleted tidak ikut muncul.

### Isi payload access token

```json
{ "sub": 5, "name": "Web Dashboard", "jti": "...", "iat": 1788534730, "exp": 1788535030 }
```

Sengaja diminimalkan: `sub` (id client), `name` (buat kebutuhan tampilan
tanpa perlu panggil `/me`), `jti`, `iat`, `exp`. Data sensitif (alamat,
telepon, tanggal lahir, dst — kalaupun nanti ada entity yang punya data
begitu) **jangan pernah** dimasukkan ke payload JWT: payload cuma
di-encode Base64URL, bukan dienkripsi, jadi siapa pun yang pegang token
bisa membacanya tanpa perlu tahu secret sama sekali. Data yang lebih
sensitif dari sekadar nama tetap harus diambil lewat endpoint terautentikasi
seperti `/me`, bukan dibaca dari token.

## Keamanan yang Sudah Diterapkan

- **Helmet** — set security headers (CSP, X-Frame-Options, dll).
- **CORS whitelist multi-origin** — hanya origin yang terdaftar di `CORS_ORIGIN`
  (comma-separated) yang boleh akses dari browser; klien non-browser
  (mobile/server-to-server) tidak terpengaruh karena tidak mengirim header Origin.
- **Rate limiting** — limit umum 100 req/15 menit, khusus login/register 10 req/15 menit
  untuk mencegah brute force menebak `client_secret`.
- **`client_secret` di-hash** — `bcrypt` 12 salt rounds, tidak pernah disimpan plaintext,
  sama seperti password.
- **Access + Refresh token (JWT)** — access token umur pendek (default 15 menit),
  refresh token umur lebih panjang (default 30 hari), masing-masing pakai secret
  terpisah (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`) dan `jti` acak supaya
  setiap token selalu unik — access token yang bocor tidak bisa dipakai untuk
  minta refresh, karena secret-nya beda.
- **Content-Type wajib `application/json`** — request `POST`/`PUT`/`PATCH` dengan
  Content-Type lain (atau tanpa Content-Type sama sekali) langsung ditolak 415,
  bukan diam-diam diproses sebagai body kosong.
- **Input validation & mass-assignment protection** — body divalidasi & disanitasi
  (Zod `.strict()`) langsung di controller sebelum masuk ke business logic.
- **SQL injection aman** — pakai Prisma (parameterized query) untuk database utama,
  dan `?` placeholder (mysql2 prepared statement) untuk database tambahan.
- **Pesan error auth generik** — "Invalid client_id or client_secret" dipakai untuk
  client_id tidak ditemukan maupun secret salah, supaya API tidak membocorkan
  client_id mana yang terdaftar.
- **Centralized error handler** — stack trace/detail internal (termasuk JSON body yang
  malformed) tidak pernah dikirim ke client saat `NODE_ENV=production`.
- **Body size limit** — dibatasi 10kb untuk mencegah payload besar yang tidak wajar.
- **Secrets via `.env`** — tidak pernah hardcode, `.env` masuk `.gitignore`.

## Trade-off yang Disadari

Refresh token **tidak disimpan di database** (stateless JWT) — cukup
signature + `exp` yang dicek, plus memastikan client-nya belum dihapus.
Ini menyederhanakan arsitektur (tidak perlu tabel/hash/rotation tambahan),
tapi konsekuensinya: server **tidak bisa mem-revoke satu refresh token
tertentu** sebelum masa berlakunya habis. Mitigasi:
- `JWT_REFRESH_EXPIRES_IN` jangan dibuat terlalu panjang.
- Kalau satu client dicurigai bocor secret/token-nya, hapus baris client
  tersebut di tabel `clients` — `refresh` akan langsung ditolak (client
  tidak ditemukan) meski token JWT-nya sendiri belum expired.
- Untuk "revoke semua sesi sekaligus" (misal `JWT_REFRESH_SECRET` bocor),
  cukup ganti nilainya di `.env` — otomatis semua refresh token lama invalid.

## Catatan

Package `prisma`/`@prisma/client` sengaja dipin ke versi stabil `6.19.3`
(bukan `latest`, yang saat ini masih rilis `8.0.0-rc`) supaya konfigurasi
database tetap sederhana (`url` langsung di `schema.prisma`) dan supaya
`npm audit` bersih dari kerentanan.
# EXPRESSJS-API
