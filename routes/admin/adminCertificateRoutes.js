

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/authMiddleware');
 
 
 const { getAdminCertificates, revokeCertificate, reissueCertificate } = require('../../controllers/certificateController');
 
 // Assume authorize('admin') is applied
 router.get('/', authenticate, authorize('admin', 'superadmin'), getAdminCertificates);
 router.put('/:id/revoke', authenticate, authorize('admin', 'superadmin'), revokeCertificate);
 router.put('/:id/reissue', authenticate, authorize('admin', 'superadmin'), reissueCertificate);
 
module.exports = router;