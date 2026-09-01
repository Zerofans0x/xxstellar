
const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, unique: true, required: true },
    description: String,
    thumbnailUrl: String,
    
    // Categorization 
    category: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Psychology', 'Risk Management'] },
    
    // Access Control
    requiredTier: { type: String, enum: ['Basic', 'Pro', 'Ultra'], default: 'Basic' },
    
    // Admin who created it
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Course', CourseSchema);