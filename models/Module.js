
const mongoose = require('mongoose');

const ModuleSchema = new mongoose.Schema({
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true }, // e.g., "Getting started with Forex"
    orderIndex: { type: Number, required: true }, // Determines display order
}, { timestamps: true });

module.exports = mongoose.model('Module', ModuleSchema);