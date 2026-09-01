// models/CourseProgress.js
const mongoose = require('mongoose');

const CourseProgressSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    
    // Tracking Video Lessons
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
    
    // Tracking Quizzes
    quizAttempts: [{
        quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
        highestScore: { type: Number, default: 0 },
        passed: { type: Boolean, default: false },
        lastAttemptTime: { type: String } // e.g., "3m 48s" matching the Figma UI
    }],

    // State marker for the frontend "Continue" button
    currentModule: { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
    currentLesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    
    completionPercentage: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false }
}, { timestamps: true });

// Ensure a user only has one progress document per course
CourseProgressSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('CourseProgress', CourseProgressSchema);