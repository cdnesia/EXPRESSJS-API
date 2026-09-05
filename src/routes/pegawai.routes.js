const { Router } = require('express');
const pegawaiController = require('../controllers/pegawai.controller');
const requireAuth = require('../middlewares/auth');
const requireScope = require('../middlewares/requireScope');

const router = Router();

router.get('/list', requireAuth, requireScope('pegawai:list'), pegawaiController.list);
router.post('/cek', requireAuth, requireScope('pegawai:cek'), pegawaiController.cek);

module.exports = router;
