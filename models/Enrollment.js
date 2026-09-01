// models/Enrollment.js
const mongoose = require('mongoose');

const EnrollmentSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    course: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Course', 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['IN_PROGRESS', 'COMPLETED', 'STALLED'], 
        default: 'IN_PROGRESS' 
    },
    progressPercentage: { 
        type: Number, 
        default: 0,
        min: 0,
        max: 100
    },
    // Arrays to track exactly which content the user has finished
    completedModules: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Module' 
    }],
    completedLessons: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Lesson' 
    }],
    completedQuizzes: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Quiz' 
    }],
    lastActiveAt: { 
        type: Date, 
        default: Date.now 
    },
    completedAt: { 
        type: Date 
    }
}, { timestamps: true });

// Ensure a user can only be enrolled in a specific course once
EnrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', EnrollmentSchema);