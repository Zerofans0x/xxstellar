const express = require('express');
const router = express.Router();
const multer = require('multer'); 
const upload = multer({ storage: multer.memoryStorage() }); 

const { 
    verifyCertificateText, 
    verifyCertificateMedia 
} = require('../controllers/certificateController');

// --- Public Routes (No Login Required) ---
router.get('/verify-text/:certificateId', verifyCertificateText);

//  MUST be a POST request, and MUST include upload.single('qrImage')
router.post('/verify-media', upload.single('qrImage'), verifyCertificateMedia);

module.exports = router;