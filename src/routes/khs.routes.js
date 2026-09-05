const { Router } = require('express');
const khsController = require('../controllers/khs.controller');
const requireAuth = require('../middlewares/auth');
const requireScope = require('../middlewares/requireScope');

const router = Router();

router.post('/cetak', requireAuth, requireScope('khs:cetak'), khsController.cetak);

module.exports = router;
