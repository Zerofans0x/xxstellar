// models/Quiz.js
const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    options: [{
        letter: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
        text: { type: String, required: true }
    }],
    correctOption: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    explanation: { type: String } // Optional: To show why an answer is correct after the quiz
});

const QuizSchema = new mongoose.Schema({
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
    title: { type: String, required: true }, // e.g., "Module 1 Quiz"
    questions: [QuestionSchema],
    passThreshold: { type: Number, default: 70 }, // Percentage required to pass
    orderIndex: { type: Number, required: true } // Where it sits in the module (usually at the end)
}, { timestamps: true });

module.exports = mongoose.model('Quiz', QuizSchema);