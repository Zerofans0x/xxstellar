const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { 
    getStudentCertificateView, 
    getCertificateData, 
    getMyCertificates 
} = require('../controllers/certificateController');

// 🛡️ All routes below this line require a logged-in student
router.use(authenticate);

// Get all certificates for the student dashboard list
router.get('/', getMyCertificates);

// Get locked/unlocked state for a specific course
router.get('/course/:courseId', getStudentCertificateView);

// Get raw JSON data for the frontend to render the "View" or "Download PDF" screen
router.get('/:certificateId/data', getCertificateData);

module.exports = router;