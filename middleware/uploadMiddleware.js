const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the temporary uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Configure Storage (Temporary Disk Storage)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Save to 'uploads/' folder
    },
    filename: function (req, file, cb) {
        // Create a unique filename: fieldname-timestamp.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File Filter (Only allow Images)
const fileFilter = (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images (jpeg, jpg, png, webp) are allowed!'), false);
    }
};

// Initialize Multer
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: fileFilter
});

module.exports = upload;