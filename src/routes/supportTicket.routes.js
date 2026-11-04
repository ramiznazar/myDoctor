const express = require('express');
const authGuard = require('../middleware/authGuard');
const { uploadMultipleDocuments } = require('../middleware/upload.middleware');
const tickets = require('../controllers/supportTicket.controller');

const router = express.Router();

router.post('/attachments', authGuard(['PATIENT', 'ADMIN']), uploadMultipleDocuments('supportTicket', 5, 25 * 1024 * 1024, 'supportTicket'), tickets.uploadAttachments);
router.get('/attachments/:attachmentId/download', authGuard(['PATIENT', 'ADMIN']), tickets.downloadAttachment);

router.get('/admin/unread-count', authGuard(['ADMIN']), tickets.getAdminUnreadCount);
router.get('/admin', authGuard(['ADMIN']), tickets.listAdmin);
router.get('/admin/:ticketId', authGuard(['ADMIN']), tickets.getAdmin);
router.patch('/admin/:ticketId', authGuard(['ADMIN']), tickets.updateAdmin);
router.post('/admin/:ticketId/messages', authGuard(['ADMIN']), tickets.replyAdmin);

router.get('/unread-count', authGuard(['PATIENT']), tickets.getMineUnreadCount);
router.get('/', authGuard(['PATIENT']), tickets.listMine);
router.post('/', authGuard(['PATIENT']), tickets.create);
router.get('/:ticketId', authGuard(['PATIENT']), tickets.getMine);
router.post('/:ticketId/messages', authGuard(['PATIENT']), tickets.reply);
router.post('/:ticketId/reopen', authGuard(['PATIENT']), tickets.reopen);

module.exports = router;
