const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const requireAuth = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiters');

const router = Router();

router.post('/login', authLimiter, authController.login);
router.post('/refresh', authLimiter, authController.refresh);
router.get('/me', requireAuth, authController.me);

module.exports = router;
