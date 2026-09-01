const express = require('express');
const router = express.Router();

// Import Middleware
const { authenticate, authorize } = require('../../middleware/authMiddleware');

// Import Controller Functions
const {
    createStaff,
    getAllAdmins,
    addAcademyUser,
    getAdminDashboardStats,
    getAdminUsers,
    toggleUserStatus,
    getAdminEnrollments,
    getAdminCertificates,
    updateCertificateStatus,
    getAdminSettings,
    updateAdminSettings,
    getAdminAuditLogs
} = require('../../controllers/admin/adminController');

const { createWeeklyOutlook, deleteWeeklyOutlook } = require('../../controllers/admin/adminWeeklyOutlookController');


// 🛡️ Apply base authentication to all admin routes
router.use(authenticate);



// ==========================================
// 👥 STAFF & ADMIN MANAGEMENT
// ==========================================
router.route('/staff')
    .get(
        authorize('superadmin', 'developer'), 
        getAllAdmins
    )
    .post(
        authorize('superadmin', 'developer'), 
        createStaff
    );

// Overview Dashboard
router.get('/dashboard', getAdminDashboardStats);

// Users Management
router.get('/users', getAdminUsers);
router.patch('/users/:id/status', toggleUserStatus);




// ==========================================
// 🎓 ACADEMY USER MANAGEMENT
// ==========================================
router.post(
    '/users',
    authorize('admin', 'superadmin', 'developer'),
    addAcademyUser
);

router.post('/weekly-outlook', authenticate, authorize('admin', 'superadmin'), createWeeklyOutlook);
router.delete('/weekly-outlook/:id', authenticate, authorize('admin', 'superadmin'), deleteWeeklyOutlook);


// Learning / Enrollments / Certificates
router.get('/enrollments', getAdminEnrollments);
router.get('/certificates', getAdminCertificates);
router.patch('/certificates/:id', updateCertificateStatus);

// System Settings & Audit Logs
router.get('/settings', getAdminSettings);
router.put('/settings', updateAdminSettings);
router.get('/audit-logs', getAdminAuditLogs);

module.exports = router;