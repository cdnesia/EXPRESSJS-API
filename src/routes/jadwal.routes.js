const { Router } = require('express');
const jadwalController = require('../controllers/jadwal.controller');
const requireAuth = require('../middlewares/auth');
const requireScope = require('../middlewares/requireScope');

const router = Router();

router.post('/list', requireAuth, requireScope('jadwal:list'), jadwalController.list);

module.exports = router;
