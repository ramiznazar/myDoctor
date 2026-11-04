const router = require('express').Router();
const authGuard = require('../middleware/authGuard');
const controller = require('../controllers/footerOption.controller');

router.get('/', controller.get);
router.put('/', authGuard(['ADMIN']), controller.update);
module.exports = router;
