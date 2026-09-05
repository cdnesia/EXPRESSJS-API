const { Router } = require('express');
const tagihanController = require('../controllers/tagihan.controller');
const requireAuth = require('../middlewares/auth');
const requireScope = require('../middlewares/requireScope');

const router = Router();

router.post('/create', requireAuth, requireScope('tagihan:create'), tagihanController.create);
router.post('/create-spp', requireAuth, requireScope('tagihan:create-spp'), tagihanController.createSpp);
router.post('/update', requireAuth, requireScope('tagihan:update'), tagihanController.update);
router.post('/cek', requireAuth, requireScope('tagihan:cek'), tagihanController.cek);

module.exports = router;
