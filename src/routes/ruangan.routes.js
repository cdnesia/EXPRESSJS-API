const { Router } = require('express');
const ruanganController = require('../controllers/ruangan.controller');
const requireAuth = require('../middlewares/auth');
const requireScope = require('../middlewares/requireScope');

const router = Router();

router.get('/list', requireAuth, requireScope('ruangan:list'), ruanganController.list);

module.exports = router;
