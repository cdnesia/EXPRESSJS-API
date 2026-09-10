const { Router } = require('express');
const krsController = require('../controllers/krs.controller');
const requireAuth = require('../middlewares/auth');
const requireScope = require('../middlewares/requireScope');

const router = Router();

router.post('/cetak', requireAuth, requireScope('krs:cetak'), krsController.cetak);

module.exports = router;
