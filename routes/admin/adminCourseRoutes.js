const express = require('express');
const router = express.Router();

// 1. Import your exact middleware functions
const { authenticate, authorize } = require('../../middleware/authMiddleware'); 

// 2. Import all your admin controllers
const {
    createCourse, updateCourse, deleteCourse, getAdminCourses, getAdminCourseById,
    createModule, updateModule, deleteModule, getAdminModuleById,
    createLesson, updateLesson, deleteLesson,
    createQuiz, updateQuiz, deleteQuiz
} = require('../../controllers/admin/adminCourseController');

// 3. Apply authentication and restrict all routes below to 'superadmin' only
router.use(authenticate, authorize('superadmin'));

// --- COURSES ---
router.route('/courses')
    .post(createCourse)
    .get(getAdminCourses); // Get All Courses

router.route('/courses/:id')
    .get(getAdminCourseById) // Get Single Course (Deep fetch with modules, lessons, quizzes)
    .put(updateCourse)
    .delete(deleteCourse);

// --- MODULES ---
router.post('/courses/:courseId/modules', createModule);
router.route('/modules/:id')
    .get(getAdminModuleById) // Get Single Module
    .put(updateModule)
    .delete(deleteModule);

// --- LESSONS ---
router.post('/modules/:moduleId/lessons', createLesson);
router.route('/lessons/:id')
    .put(updateLesson)
    .delete(deleteLesson);

// --- QUIZZES ---
router.post('/modules/:moduleId/quizzes', createQuiz);
router.route('/quizzes/:id')
    .put(updateQuiz)
    .delete(deleteQuiz);

module.exports = router;