const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');
const { closeAllPools } = require('./config/db');
const { closeBrowser, getBrowser } = require('./utils/pdf');

const server = app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port} [${env.nodeEnv}]`);
});

// Launch Chrome saat proses start, bukan nunggu request PDF pertama —
// tanpa ini, request cetak KHS/KRS pertama setelah tiap deploy/restart
// (sync.sh restart container tiap update kecil) ikut nanggung biaya
// launch Chrome (beberapa detik) di atas latensi render normalnya.
getBrowser().catch((err) => {
  console.error('Gagal pre-warm Puppeteer browser:', err);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    await closeAllPools();
    await closeBrowser();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
