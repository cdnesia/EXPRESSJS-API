const { Router } = require('express');
const authRoutes = require('./auth.routes');
const tagihanRoutes = require('./tagihan.routes');
const telegramRoutes = require('./telegram.routes');
const pegawaiRoutes = require('./pegawai.routes');
const bipotRoutes = require('./bipot.routes');
const khsRoutes = require('./khs.routes');
const prisma = require('../config/prisma');
const { getPool, registeredDatabaseNames } = require('../config/db');
const ApiResponse = require('../utils/ApiResponse');

const router = Router();

router.get('/health', async (req, res) => {
  const databases = { MAIN: 'unknown' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    databases.MAIN = 'up';
  } catch (err) {
    databases.MAIN = 'down';
  }

  await Promise.all(
    registeredDatabaseNames().map(async (name) => {
      try {
        await getPool(name).query('SELECT 1');
        databases[name] = 'up';
      } catch (err) {
        databases[name] = 'down';
      }
    })
  );

  const allUp = Object.values(databases).every((status) => status === 'up');
  res.status(allUp ? 200 : 503).json({ success: allUp, data: { status: allUp ? 'ok' : 'degraded', databases } });
});

router.use('/auth', authRoutes);
router.use('/tagihan', tagihanRoutes);
router.use('/telegram', telegramRoutes);
router.use('/pegawai', pegawaiRoutes);
router.use('/bipot', bipotRoutes);
router.use('/khs', khsRoutes);

module.exports = router;
