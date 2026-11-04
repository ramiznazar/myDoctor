const router = require('express').Router();
const authGuard = require('../middleware/authGuard');
const controller = require('../controllers/contactQuery.controller');

router.post('/', controller.create);
router.get('/', authGuard(['ADMIN']), controller.list);
router.get('/:id', authGuard(['ADMIN']), controller.get);
router.patch('/:id', authGuard(['ADMIN']), controller.update);
router.delete('/:id', authGuard(['ADMIN']), controller.remove);
module.exports = router;
