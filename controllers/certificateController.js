const asyncHandler = require('express-async-handler');
const Certificate = require('../models/Certificate');
const CourseProgress = require('../models/CourseProgress');
const Course = require('../models/Course');
const jsQR = require('jsqr');
const { Jimp } = require('jimp');

// ==========================================
// 🎓 STUDENT DOMAIN
// ==========================================

// @desc    Get Certificate UI State for a specific course
// @route   GET /api/v1/psyche/certificates/course/:courseId
// @access  Private (Student)
const getStudentCertificateView = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const userId = req.user._id;

    const progress = await CourseProgress.findOne({ user: userId, course: courseId });
    
    // STATE 1: Locked Certificate (Certificate-1.jpg)
    if (!progress || !progress.isCompleted) {
        return res.status(200).json({
            success: true,
            data: {
                status: 'LOCKED',
                message: "Complete your required Psychedelia courses to unlock your certificate of completion",
                action: {
                    label: "View course progress",
                    url: `/dashboard/courses/${courseId}`
                }
            }
        });
    }

    // Fetch or Generate the Certificate
    let cert = await Certificate.findOne({ user: userId, course: courseId }).populate('course', 'title');
    if (!cert) {
        cert = await Certificate.create({ user: userId, course: courseId });
        cert = await cert.populate('course', 'title');
    }

    // Determine the next course in the learning path (Mocked logic)
    const nextCourse = await Course.findOne({ _id: { $ne: courseId } }).select('_id title');

    // STATE 2: Unlocked Certificate (Certificate-2.jpg & Certificate-3.jpg)
    res.status(200).json({
        success: true,
        data: {
            status: 'UNLOCKED',
            certificate: {
                id: cert.certificateId,
                recipientName: req.user.fullName, // Adjust based on your auth req.user
                courseTitle: cert.course.title,
                issueDate: cert.issuedAt,
                publicLink: `${process.env.PSYCHE_FRONTEND_URL}/verify/${cert.certificateId}`,
                downloadUrl: `/api/v1/certificates/download/${cert.certificateId}`
            },
            achievement: {
                title: "Achievement unlocked",
                description: "You've completed your first PSY WEB course. 11 more in your beginner path."
            },
            nextAction: nextCourse ? {
                label: "Start next course",
                courseId: nextCourse._id
            } : null
        }
    });
});

// ==========================================
// 🔍 PUBLIC VERIFICATION DOMAIN
// ==========================================

// @desc    Verify Certificate by ID String
// @route   GET /api/v1/certificates/verify/text/:certificateId
// @access  Public
const verifyCertificateText = asyncHandler(async (req, res) => {
    const { certificateId } = req.params;
    const cert = await Certificate.findOne({ certificateId }).populate('user', 'fullName').populate('course', 'title');

    if (!cert) {
        // STATE: Not Found (certificate-6.jpg)
        return res.status(404).json({
            success: false,
            verificationState: 'NOT_FOUND',
            message: "We couldn't find a valid certificate with the provided details."
        });
    }

    if (cert.status === 'revoked') {
        // STATE: Not Authentic (Certificate - 7.jpg)
        return res.status(200).json({
            success: false,
            verificationState: 'NOT_AUTHENTIC',
            message: "This certificate was issued but has since been revoked. It is not authentic."
        });
    }

    // STATE: Authentic (Certificate-5.jpg)
    res.status(200).json({
        success: true,
        verificationState: 'AUTHENTIC',
        data: {
            recipient: cert.user.fullName,
            course: cert.course.title,
            issueDate: cert.issuedAt,
            certificateId: cert.certificateId
        }
    });
});

// @desc    Verify Certificate via Uploaded QR Image
// @route   POST /api/v1/certificates/verify/media
// @access  Public
const verifyCertificateMedia = asyncHandler(async (req, res) => {
    // Requires multer middleware on the route: upload.single('qrImage')
    if (!req.file) {
        res.status(400); throw new Error("Please upload a QR image file.");
    }

    try {
        // 1. Read image buffer with Jimp
        const image = await Jimp.read(req.file.buffer);
        
        // 2. Extract raw pixel data formatted for jsQR
        const imageData = { 
            data: new Uint8ClampedArray(image.bitmap.data), 
            width: image.bitmap.width, 
            height: image.bitmap.height 
        };
        
        // 3. Decode QR
        const decodedQR = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (!decodedQR) {
            return res.status(400).json({
                success: false,
                verificationState: 'NOT_FOUND',
                message: "Could not detect a valid QR code in this image. Please ensure the image is clear."
            });
        }
        
        // The QR code will contain the frontend URL (e.g., "https://frontend.com/verify/PSY-2026-08-22-ABCDE")
        // We split the URL by '/' and pop the last element to get just the ID.
       // The QR code will contain the frontend URL
        const qrText = decodedQR.data;
        
        // Split by '/' and take the last part, then TRIM any invisible spaces
        const extractedCertId = qrText.split('/').pop().trim(); 

        // // 🟢 ADD THESE LOGS to see exactly what the server is reading:
        // console.log("1. Raw QR Text Scanned:", qrText);
        // console.log("2. Cleaned ID searching DB:", extractedCertId);

        // 4. Pass the extracted ID to your standard text verification logic
        req.params.certificateId = extractedCertId;
        return verifyCertificateText(req, res);

    } catch (error) {
        console.error("QR Decode Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process the image media.",
            errorDetails: error.message
        });
    }
});

// ==========================================
// 🛡️ ADMIN DOMAIN
// ==========================================

// @desc    Get all issued certificates (Admin Table)
// @route   GET /api/v1/admin/certificates
// @access  Private (Admin)
const getAdminCertificates = asyncHandler(async (req, res) => {
    const certificates = await Certificate.find()
        .populate('user', 'fullName email')
        .populate('course', 'title')
        .sort({ issuedAt: -1 });

    res.status(200).json({
        success: true,
        count: certificates.length,
        data: certificates
    });
});


// @desc    Revoke a certificate
// @route   PUT /api/v1/admin/certificates/:id/revoke
// @access  Private (Admin)
const revokeCertificate = asyncHandler(async (req, res) => {
    const cert = await Certificate.findOne({ certificateId: req.params.id });
    
    if (!cert) {
        res.status(404); throw new Error("Certificate not found");
    }

    cert.status = 'revoked';
    await cert.save();

    res.status(200).json({
        success: true,
        message: "Certificate revoked successfully"
    });
});

// @desc    Reissue a certificate
// @route   PUT /api/v1/admin/certificates/:id/reissue
// @access  Private (Admin)
const reissueCertificate = asyncHandler(async (req, res) => {
    const cert = await Certificate.findOne({ certificateId: req.params.id });
    
    if (!cert) {
        res.status(404); throw new Error("Certificate not found");
    }

    cert.status = 'valid';
    cert.issuedAt = Date.now();
    await cert.save();

    res.status(200).json({
        success: true,
        message: "Certificate reissued successfully",
        data: cert
    });
});

// @desc    Get all certificates for the logged-in student
// @route   GET /api/v1/psyche/certificates
// @access  Private (Student)
const getMyCertificates = asyncHandler(async (req, res) => {
    const certificates = await Certificate.find({ user: req.user._id })
        .populate('course', 'title')
        .sort({ issuedAt: -1 });

    res.status(200).json({
        success: true,
        count: certificates.length,
        data: certificates.map(cert => ({
            id: cert.certificateId,
            courseTitle: cert.course.title,
            issueDate: cert.issuedAt,
            status: cert.status
        }))
    });
});

// @desc    Get raw certificate data for Frontend Rendering (View / Download)
// @route   GET /api/v1/psyche/certificates/:certificateId/data
// @access  Private (Student)
const getCertificateData = asyncHandler(async (req, res) => {
    const cert = await Certificate.findOne({ certificateId: req.params.certificateId })
        .populate('user', 'fullName')
        .populate('course', 'title');

    if (!cert) {
        res.status(404); throw new Error("Certificate not found");
    }

    // Pass the raw data to the frontend so it can paint the UI and export the PDF
    res.status(200).json({
        success: true,
        data: {
            certificateId: cert.certificateId,
            recipientName: cert.user.fullName,
            courseTitle: cert.course.title,
            issueDate: cert.issuedAt,
            issuer: "Psychedelia",
            signature: "Uche Christopher, CEO",
            qrLink: `${process.env.PSYCHE_FRONTEND_URL}/verify/${cert.certificateId}`
        }
    });
});

module.exports = {
    getStudentCertificateView,
    getCertificateData,
    getMyCertificates,
    verifyCertificateText,
    verifyCertificateMedia,
    getAdminCertificates,
    revokeCertificate,
    reissueCertificate
};