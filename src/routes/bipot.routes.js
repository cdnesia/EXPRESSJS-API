const { Router } = require('express');
const bipotController = require('../controllers/bipot.controller');
const requireAuth = require('../middlewares/auth');
const requireScope = require('../middlewares/requireScope');

const router = Router();

router.get('/list', requireAuth, requireScope('bipot:list'), bipotController.list);

module.exports = router;
