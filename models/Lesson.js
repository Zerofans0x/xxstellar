const mongoose = require('mongoose');

const LessonSchema = new mongoose.Schema({
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
    title: { type: String, required: true },
    description: String,
    orderIndex: { type: Number, required: true }, // Order within the module
    durationMinutes: Number,

    // --- AwaStream Video Streaming Logic Integrated Here ---
    sourceType: { type: String, enum: ['direct', 'youtube'], required: true },
    sourceId: { type: String, required: true }, // S3 Key or YouTube ID
    
    // Optional Resources
    resources: [{ title: String, fileUrl: String }]
}, { timestamps: true });

module.exports = mongoose.model('Lesson', LessonSchema);