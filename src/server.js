const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');
const { closeAllPools } = require('./config/db');
const { closeBrowser } = require('./utils/pdf');

const server = app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port} [${env.nodeEnv}]`);
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
