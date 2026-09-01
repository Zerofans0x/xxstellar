const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { createAuditLog } = require('../../utils/auditLogger');
const Course = require('../../models/Course');
const Enrollment = require('../../models/Enrollment');
const Certificate = require('../../models/Certificate');
const SystemSettings = require('../../models/SystemSettings');
const AuditLog = require('../../models/AuditLog');
const BiasVote = require('../../models/BiasVote'); 
const BiasInstrument = require('../../models/BiasInstrument'); 

// ==========================================
// 📊 DASHBOARD OVERVIEW
// ==========================================
// @desc    Get Admin Dashboard Stats & Sentiment
// @route   GET /api/v1/admin/dashboard
// @access  Private/Admin
const getAdminDashboardStats = asyncHandler(async (req, res) => {
    // Course Metrics
    const totalCourses = await Course.countDocuments();
    const publishedCourses = await Course.countDocuments({ isPublished: true });
    const totalEnrollments = await Enrollment.countDocuments();
    
    // Average completion calculation
    const completedCount = await Enrollment.countDocuments({ status: 'COMPLETED' });
    const avgCompletionRate = totalEnrollments > 0 ? Math.round((completedCount / totalEnrollments) * 100) : 0;

    // Bias Voting Metrics
    const votesCastThisWeek = await BiasVote.countDocuments();
    const activeVoters = (await BiasVote.distinct('user')).length;
    const openInstruments = await BiasInstrument.countDocuments({ active: true });

    // Sentiment Breakdown per Instrument
    const instruments = await BiasInstrument.find({ active: true });
    const sentimentBreakdown = await Promise.all(instruments.map(async (inst) => {
        const total = await BiasVote.countDocuments({ instrument: inst._id });
        const bull = await BiasVote.countDocuments({ instrument: inst._id, vote: 'BULL' });
        const bear = await BiasVote.countDocuments({ instrument: inst._id, vote: 'BEAR' });

        return {
            symbol: inst.symbol,
            bullPercentage: total > 0 ? Math.round((bull / total) * 100) : 50,
            bearPercentage: total > 0 ? Math.round((bear / total) * 100) : 50
        };
    }));

    res.status(200).json({
        success: true,
        data: {
            metrics: {
                totalCourses,
                publishedCourses,
                totalEnrollments,
                avgCompletionRate: `${avgCompletionRate}%`,
                votesCastThisWeek,
                activeVoters,
                communityAccuracy: '76%',
                openInstruments
            },
            sentimentBreakdown
        }
    });
});

// ==========================================
// 👥 USER MANAGEMENT
// ==========================================
// @desc    Get All Users with search and filtering
// @route   GET /api/v1/admin/users
// @access  Private/Admin
const getAdminUsers = asyncHandler(async (req, res) => {
    const { search, status } = req.query;
    let query = {};

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { country: { $regex: search, $options: 'i' } }
        ];
    }

    if (status) {
        query.status = status.toUpperCase();
    }

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: users.length,
        data: users
    });
});

// @desc    Suspend or Activate User
// @route   PATCH /api/v1/admin/users/:id/status
// @access  Private/Admin
const toggleUserStatus = asyncHandler(async (req, res) => {
    const { status } = req.body; // e.g., 'SUSPENDED' or 'ACTIVE'
    const user = await User.findById(req.params.id);

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    // Convert the incoming uppercase status to lowercase to match the DB schema
    const safeStatus = status.toLowerCase();

    user.status = safeStatus;
    await user.save();

    const adminName = req.user && (req.user.fullName || req.user.firstName || req.user.name) ? 
                      (req.user.fullName || req.user.firstName || req.user.name) : 
                      'System Admin';
                      
    const adminId = req.user ? (req.user._id || req.user.id) : null;
    const targetUserName = user.fullName || user.email || 'User';

    await createAuditLog({
        initiatorId: adminId,
        initiatorName: adminName,
        action: `${safeStatus === 'suspended' ? 'Suspended' : 'Activated'} user account for ${targetUserName}`,
        category: 'Admin',
        status: 'Success'
    });

    res.status(200).json({
        success: true,
        message: `User status updated to ${safeStatus}`,
        data: user
    });
});


// ==========================================
// 🎓 ENROLLMENTS & CERTIFICATES
// ==========================================
// @desc    Get Student Enrollments
// @route   GET /api/v1/admin/enrollments
// @access  Private/Admin
const getAdminEnrollments = asyncHandler(async (req, res) => {
    const { status, search } = req.query;
    let filter = {};

    if (status && status !== 'All') {
        filter.status = status.toUpperCase().replace(' ', '_');
    }

    const enrollments = await Enrollment.find(filter)
        .populate('user', 'name country')
        .populate('course', 'title')
        .sort({ updatedAt: -1 });

    res.status(200).json({
        success: true,
        data: enrollments
    });
});

// @desc    Get Issued Certificates
// @route   GET /api/v1/admin/certificates
// @access  Private/Admin
const getAdminCertificates = asyncHandler(async (req, res) => {
    const certificates = await Certificate.find().sort({ issuedAt: -1 });
    res.status(200).json({
        success: true,
        data: certificates
    });
});

// @desc    Revoke or Reissue Certificate
// @route   PATCH /api/v1/admin/certificates/:id
// @access  Private/Admin
const updateCertificateStatus = asyncHandler(async (req, res) => {
    const { action } = req.body; // 'REISSUE' or 'REVOKE'
    const cert = await Certificate.findById(req.params.id);

    if (!cert) {
        res.status(404);
        throw new Error("Certificate not found");
    }

    cert.status = action === 'REVOKE' ? 'REVOKED' : 'ISSUED';
    await cert.save();

    const adminName = req.user && (req.user.fullName || req.user.firstName || req.user.name) ? 
                      (req.user.fullName || req.user.firstName || req.user.name) : 
                      'System Admin';
                      
    const adminId = req.user ? (req.user._id || req.user.id) : null;

    await createAuditLog({
        initiatorId: adminId,
        initiatorName: adminName,
        action: `${action === 'REVOKE' ? 'Revoked' : 'Reissued'} certificate for ${cert.userName || 'Student'}`,
        category: 'Admin',
        status: 'Success'
    });


    res.status(200).json({
        success: true,
        message: `Certificate successfully ${cert.status.toLowerCase()}`,
        data: cert
    });
});

// ==========================================
// ⚙️ SYSTEM SETTINGS & AUDIT LOGS
// ==========================================
// @desc    Get Admin System Settings
// @route   GET /api/v1/admin/settings
// @access  Private/Admin
const getAdminSettings = asyncHandler(async (req, res) => {
    let settings = await SystemSettings.findOne();
    if (!settings) {
        settings = await SystemSettings.create({});
    }

    res.status(200).json({
        success: true,
        data: settings
    });
});


// @desc    Update Admin System Settings
// @route   PUT /api/v1/admin/settings
// @access  Private/Admin
const updateAdminSettings = asyncHandler(async (req, res) => {
    let settings = await SystemSettings.findOne();
    if (!settings) {
        settings = new SystemSettings();
    }

    Object.assign(settings, req.body);
    await settings.save();

    // FIX: Added robust fallbacks for initiator credentials
    const adminName = req.user && (req.user.fullName || req.user.firstName || req.user.name) ? 
                      (req.user.fullName || req.user.firstName || req.user.name) : 
                      'System Admin';
                      
    const adminId = req.user ? (req.user._id || req.user.id) : null;

    await createAuditLog({
        initiatorId: adminId,
        initiatorName: adminName,
        action: "Updated Market Insights voting system settings",
        category: 'Admin',
        status: 'Success'
    });

    res.status(200).json({
        success: true,
        message: "Settings updated successfully",
        data: settings
    });
});

// @desc    Get Audit Logs
// @route   GET /api/v1/admin/audit-logs
// @access  Private/Admin
const getAdminAuditLogs = asyncHandler(async (req, res) => {
    // FIX: Changed 'timestamp' to 'createdAt'
    const logs = await AuditLog.find().sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        data: logs
    });
});

// @desc    Create a new Staff Member (Admin / Superadmin)
// @route   POST /api/v1/admin/staff
// @access  Private (Developer & Superadmin Only)
const createStaff = asyncHandler(async (req, res) => {
    const { fullName, email, password, targetRole, permissions } = req.body;

    if (!fullName || !email || !password || !targetRole) {
        res.status(400); throw new Error("Please provide all fields.");
    }

    const creatorRole = req.user.role;

    if (creatorRole === 'superadmin' && targetRole !== 'admin') {
        res.status(403); 
        throw new Error("Superadmins can only create read-only 'admin' accounts.");
    }

    if (creatorRole === 'developer' && !['superadmin', 'admin'].includes(targetRole)) {
        res.status(400); 
        throw new Error("Developers can only create 'superadmin' or 'admin' accounts.");
    }

    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
        res.status(400); throw new Error("An account with this email already exists.");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const nameParts = fullName.trim().split(/\s+/);

    let assignedPermissions = permissions || {
        viewAnalytics: false,
        manageUsers: false,
        manageCourses: false, // Changed from editStrategies
        viewSystemLogs: false
    };

    if (targetRole === 'superadmin' || targetRole === 'developer') {
        assignedPermissions = {
            viewAnalytics: true,
            manageUsers: true,
            manageCourses: true,
            viewSystemLogs: true
        };
    }

    const staffUser = await User.create({
        fullName: fullName,
        firstName: nameParts[0],
        lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
        email: email.toLowerCase().trim(),
        passwordHash: passwordHash,
        authMethod: 'local',
        role: targetRole,
        permissions: assignedPermissions,
        isEmailVerified: true, 
        isOnboarded: true, 
        status: 'active'
    });

    const adminName = req.user && (req.user.fullName || req.user.firstName || req.user.name) ? 
                      (req.user.fullName || req.user.firstName || req.user.name) : 
                      'System Admin';
                      
    const adminId = req.user ? (req.user._id || req.user.id) : null;

    await createAuditLog({
        initiatorId: adminId,
        initiatorName: adminName,
        action: `Created new ${targetRole} account for ${email}`,
        category: 'Admin',
        status: 'Success'
    });

    res.status(201).json({
        success: true,
        message: `${targetRole.toUpperCase()} account created successfully for ${fullName}.`,
        data: {
            id: staffUser._id,
            fullName: staffUser.fullName,
            email: staffUser.email,
            role: staffUser.role,
            permissions: staffUser.permissions
        }
    });
});

// @desc    Get Administrator Directory
// @route   GET /api/v1/admin/staff
// @access  Private (Superadmin, Developer)
const getAllAdmins = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;

    const parsedLimit = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * parsedLimit;

    const query = { role: { $in: ['admin', 'superadmin', 'developer'] } };
    const now = new Date();
    const activeThreshold = new Date(now.getTime() - (2 * 60 * 60 * 1000));

    const [admins, totalAdmins, activeSessions, pendingInvites] = await Promise.all([
        User.find(query).sort({ createdAt: -1 }).skip(skip).limit(parsedLimit).lean(),
        User.countDocuments(query),
        User.countDocuments({ ...query, lastLogin: { $gte: activeThreshold } }),
        User.countDocuments({ ...query, status: 'pending' })
    ]);

    const formattedAdmins = admins.map(admin => {
        let roleDisplay = admin.role;
        if (admin.role === 'superadmin') roleDisplay = 'Super Admin';
        if (admin.role === 'admin') {
            if (admin.permissions?.manageCourses) roleDisplay = 'Editor';
            else if (admin.permissions?.viewAnalytics && !admin.permissions?.manageUsers) roleDisplay = 'Read-only';
            else roleDisplay = 'Admin';
        }

        return {
            id: admin._id,
            name: admin.fullName,
            email: admin.email,
            role: roleDisplay,
            rawRole: admin.role,
            lastActive: admin.lastLogin || null,
            status: admin.status,
            permissions: admin.permissions || {}
        };
    });

    res.status(200).json({
        success: true,
        data: {
            topStats: {
                totalAdmins: totalAdmins,
                activeSessions: activeSessions,
                pendingInvites: pendingInvites
            },
            table: {
                total: totalAdmins,
                page: parseInt(page, 10),
                limit: parsedLimit,
                totalPages: Math.ceil(totalAdmins / parsedLimit),
                admins: formattedAdmins
            }
        }
    });
});

// @desc    Admin manually creates a user
// @route   POST /api/v1/admin/users
const addAcademyUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, password, role, planSlug } = req.body;

    if (!firstName || !email || !password) {
        res.status(400); throw new Error('First name, email, and password are required.');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400); throw new Error('User already exists with this email.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const generatedFullName = `${firstName} ${lastName || ''}`.trim();

    const user = await User.create({
        fullName: generatedFullName,
        firstName,
        lastName: lastName || '',
        email,
        passwordHash: hashedPassword,
        authMethod: 'local',
        role: role || 'student', // Changed default role
        isEmailVerified: true, 
        isOnboarded: true,
        subscription: {
            plan: planSlug || 'free',
            status: 'active',
            isTrialActive: false,
            hasUsedTrial: true 
        }
    });

    if (user) {
        // RadarProfile logic removed - place any Academy-specific initialization here (e.g., enrolling in a default onboarding course)

        res.status(201).json({
            success: true,
            message: `User ${email} created successfully.`,
            data: { id: user._id, email: user.email, role: user.role, plan: user.subscription.plan }
        });
    } else {
        res.status(400); throw new Error('Invalid user data received.');
    }
});



module.exports = {
    getAdminDashboardStats,
    getAdminUsers,
    createStaff,
    getAllAdmins,
    addAcademyUser,
    toggleUserStatus,
    getAdminEnrollments,
    getAdminCertificates,
    updateCertificateStatus,
    getAdminSettings,
    updateAdminSettings,
    getAdminAuditLogs
};
