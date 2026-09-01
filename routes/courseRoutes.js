const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
    getCourses,
    getCourseBySlug,
    generateLessonAccess,
    streamLessonVideo,
    getQuiz,
    submitQuiz
} = require('../controllers/courseController');

// Public/Authenticated catalog browsing
router.get('/', authenticate, getCourses);
router.get('/:slug', authenticate, getCourseBySlug);

// Lesson streaming and token access
router.post('/lessons/:lessonId/access', authenticate, generateLessonAccess);
router.get('/stream/:lessonId', streamLessonVideo);

// Quiz endpoints
router.get('/quizzes/:quizId', authenticate, getQuiz);
router.post('/quizzes/:quizId/submit', authenticate, submitQuiz);

module.exports = router;