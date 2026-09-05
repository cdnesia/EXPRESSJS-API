const { Router } = require('express');
const telegramController = require('../controllers/telegram.controller');
const requireAuth = require('../middlewares/auth');
const requireScope = require('../middlewares/requireScope');

const router = Router();

router.post(
  '/send-message',
  requireAuth,
  requireScope('telegram:send-message'),
  telegramController.sendMessage
);

module.exports = router;
