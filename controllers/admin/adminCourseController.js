const asyncHandler = require('express-async-handler');
const Course = require('../../models/Course');
const Module = require('../../models/Module');
const Lesson = require('../../models/Lesson');
const Quiz = require('../../models/Quiz');
const { getYouTubeVideoId } = require('../../services/youtubeService'); 


// @desc    Create a new Course
// @route   POST /api/v1/admin/courses
// @access  Private (Superadmin)
const createCourse = asyncHandler(async (req, res) => {
    const { title, description, category, requiredTier, thumbnailUrl } = req.body;

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const course = await Course.create({
        title,
        slug,
        description,
        category,
        requiredTier, // 'Basic', 'Pro', 'Ultra'
        thumbnailUrl,
        createdBy: req.user.id
    });

    res.status(201).json({ success: true, course });
});

// @desc    Add a Module to a Course
// @route   POST /api/v1/admin/courses/:courseId/modules
// @access  Private (Superadmin)
const createModule = asyncHandler(async (req, res) => {
    const { title, orderIndex } = req.body;
    const { courseId } = req.params;

    const courseExists = await Course.findById(courseId);
    if (!courseExists) {
        res.status(404); throw new Error('Course not found');
    }

    const newModule = await Module.create({
        course: courseId,
        title,
        orderIndex
    });

    res.status(201).json({ success: true, module: newModule });
});


// @desc    Add a Video Lesson to a Module
// @route   POST /api/v1/admin/modules/:moduleId/lessons
// @access  Private (Superadmin)
const createLesson = asyncHandler(async (req, res) => {
    // We now accept 'youtubeUrl' and 's3Key' from the admin form
    const { title, description, orderIndex, durationMinutes, sourceType, youtubeUrl, s3Key } = req.body;
    const { moduleId } = req.params;

    const moduleExists = await Module.findById(moduleId);
    if (!moduleExists) {
        res.status(404); throw new Error('Module not found');
    }

    let parsedSourceId = '';

    // Automatically extract the ID based on the source type
    if (sourceType === 'youtube') {
        if (!youtubeUrl) {
            res.status(400); throw new Error('Please provide a valid YouTube URL.');
        }
        parsedSourceId = getYouTubeVideoId(youtubeUrl);
        if (!parsedSourceId) {
            res.status(400); throw new Error('Could not extract a valid YouTube ID from the provided URL.');
        }
    } else if (sourceType === 'direct') {
        if (!s3Key) {
            res.status(400); throw new Error('S3 Key is required for direct uploads.');
        }
        parsedSourceId = s3Key;
    } else {
        res.status(400); throw new Error('Invalid source type. Must be youtube or direct.');
    }

    const lesson = await Lesson.create({
        module: moduleId,
        title,
        description,
        orderIndex,
        durationMinutes,
        sourceType, 
        sourceId: parsedSourceId // Save the clean ID to the database
    });

    res.status(201).json({ success: true, lesson });
});


// @desc    Add a Quiz to a Module
// @route   POST /api/v1/admin/modules/:moduleId/quizzes
// @access  Private (Superadmin)
const createQuiz = asyncHandler(async (req, res) => {
    const { title, passThreshold, orderIndex, questions } = req.body;
    const { moduleId } = req.params;

    const moduleExists = await Module.findById(moduleId);
    if (!moduleExists) {
        res.status(404); throw new Error('Module not found');
    }

    // Expected questions format from frontend:
    // [{ questionText: "...", options: [{letter: "A", text: "..."}], correctOption: "A" }]

    const quiz = await Quiz.create({
        module: moduleId,
        title,
        passThreshold,
        orderIndex,
        questions
    });

    res.status(201).json({ success: true, quiz });
});

// ==========================================
// COURSE CRUD
// ==========================================

// @desc    Update a Course
// @route   PUT /api/v1/admin/courses/:id
// @access  Private (Superadmin)
const updateCourse = asyncHandler(async (req, res) => {
    let course = await Course.findById(req.params.id);
    if (!course) {
        res.status(404); throw new Error('Course not found');
    }

    // If title changes, update the slug automatically
    if (req.body.title && req.body.title !== course.title) {
        req.body.slug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    course = await Course.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({ success: true, course });
});

// @desc    Delete a Course (and cascade delete its modules, lessons, and quizzes)
// @route   DELETE /api/v1/admin/courses/:id
// @access  Private (Superadmin)
const deleteCourse = asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.id);
    if (!course) {
        res.status(404); throw new Error('Course not found');
    }

    // Find all modules belonging to this course
    const modules = await Module.find({ course: course._id });
    const moduleIds = modules.map(m => m._id);

    // Cascade delete everything attached to these modules
    await Lesson.deleteMany({ module: { $in: moduleIds } });
    await Quiz.deleteMany({ module: { $in: moduleIds } });
    await Module.deleteMany({ course: course._id });
    
    // Finally, delete the course
    await course.deleteOne();

    res.status(200).json({ success: true, message: 'Course and all related content deleted successfully.' });
});

// ==========================================
// MODULE CRUD
// ==========================================

// @desc    Update a Module
// @route   PUT /api/v1/admin/modules/:id
// @access  Private (Superadmin)
const updateModule = asyncHandler(async (req, res) => {
    const module = await Module.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    if (!module) {
        res.status(404); throw new Error('Module not found');
    }

    res.status(200).json({ success: true, module });
});

// @desc    Delete a Module (and cascade delete its lessons and quizzes)
// @route   DELETE /api/v1/admin/modules/:id
// @access  Private (Superadmin)
const deleteModule = asyncHandler(async (req, res) => {
    const module = await Module.findById(req.params.id);
    if (!module) {
        res.status(404); throw new Error('Module not found');
    }

    await Lesson.deleteMany({ module: module._id });
    await Quiz.deleteMany({ module: module._id });
    await module.deleteOne();

    res.status(200).json({ success: true, message: 'Module and its lessons/quizzes deleted.' });
});

// ==========================================
// LESSON CRUD
// ==========================================

// @desc    Update a Lesson
// @route   PUT /api/v1/admin/lessons/:id
// @access  Private (Superadmin)
const updateLesson = asyncHandler(async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
        res.status(404); throw new Error('Lesson not found');
    }

    const { sourceType, youtubeUrl, s3Key, ...otherUpdates } = req.body;
    let updates = { ...otherUpdates };

    // If the admin is updating the video source, recalculate the ID
    if (sourceType) {
        updates.sourceType = sourceType;
        if (sourceType === 'youtube') {
            if (!youtubeUrl) {
                res.status(400); throw new Error('Please provide a valid YouTube URL.');
            }
            const parsedSourceId = getYouTubeVideoId(youtubeUrl);
            if (!parsedSourceId) {
                res.status(400); throw new Error('Could not extract a valid YouTube ID.');
            }
            updates.sourceId = parsedSourceId;
        } else if (sourceType === 'direct') {
            if (!s3Key) {
                res.status(400); throw new Error('S3 Key is required for direct uploads.');
            }
            updates.sourceId = s3Key;
        }
    }

    const updatedLesson = await Lesson.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true
    });

    res.status(200).json({ success: true, lesson: updatedLesson });
});

// @desc    Delete a Lesson
// @route   DELETE /api/v1/admin/lessons/:id
// @access  Private (Superadmin)
const deleteLesson = asyncHandler(async (req, res) => {
    const lesson = await Lesson.findByIdAndDelete(req.params.id);
    if (!lesson) {
        res.status(404); throw new Error('Lesson not found');
    }
    res.status(200).json({ success: true, message: 'Lesson deleted.' });
});

// ==========================================
// QUIZ CRUD
// ==========================================

// @desc    Update a Quiz
// @route   PUT /api/v1/admin/quizzes/:id
// @access  Private (Superadmin)
const updateQuiz = asyncHandler(async (req, res) => {
    const quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    if (!quiz) {
        res.status(404); throw new Error('Quiz not found');
    }

    res.status(200).json({ success: true, quiz });
});

// @desc    Delete a Quiz
// @route   DELETE /api/v1/admin/quizzes/:id
// @access  Private (Superadmin)
const deleteQuiz = asyncHandler(async (req, res) => {
    const quiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!quiz) {
        res.status(404); throw new Error('Quiz not found');
    }
    res.status(200).json({ success: true, message: 'Quiz deleted.' });
});


// ==========================================
// ADMIN READ (GET) OPERATIONS
// ==========================================

// @desc    Get all courses (Admin view - includes inactive ones if you add that flag later)
// @route   GET /api/v1/admin/courses
// @access  Private (Superadmin)
const getAdminCourses = asyncHandler(async (req, res) => {
    const courses = await Course.find({})
        .sort({ createdAt: -1 })
        .populate('createdBy', 'firstName lastName email'); // See who created it

    res.status(200).json({
        success: true,
        count: courses.length,
        data: courses
    });
});

// @desc    Get a single course with FULL tree (Modules, Lessons, Quizzes)
// @route   GET /api/v1/admin/courses/:id
// @access  Private (Superadmin)
const getAdminCourseById = asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.id)
        .populate('createdBy', 'firstName lastName email');

    if (!course) {
        res.status(404); throw new Error('Course not found');
    }

    // Fetch modules and nest the lessons/quizzes inside them
    const modules = await Module.find({ course: course._id }).sort({ orderIndex: 1 }).lean();

    for (let i = 0; i < modules.length; i++) {
        modules[i].lessons = await Lesson.find({ module: modules[i]._id }).sort({ orderIndex: 1 });
        modules[i].quizzes = await Quiz.find({ module: modules[i]._id }).sort({ orderIndex: 1 });
    }

    res.status(200).json({
        success: true,
        data: {
            ...course.toObject(),
            modules
        }
    });
});

// @desc    Get a single module with its lessons and quizzes
// @route   GET /api/v1/admin/modules/:id
// @access  Private (Superadmin)
const getAdminModuleById = asyncHandler(async (req, res) => {
    const module = await Module.findById(req.params.id);

    if (!module) {
        res.status(404); throw new Error('Module not found');
    }

    const lessons = await Lesson.find({ module: module._id }).sort({ orderIndex: 1 });
    const quizzes = await Quiz.find({ module: module._id }).sort({ orderIndex: 1 });

    res.status(200).json({
        success: true,
        data: {
            ...module.toObject(),
            lessons,
            quizzes
        }
    });
});

    
// Make sure to export all of them
module.exports = {
    createCourse,
    updateCourse,
    deleteCourse,
    getAdminCourses,
    getAdminCourseById,
    getAdminModuleById,
    createModule,
    updateModule,
    deleteModule,
    createLesson,
    updateLesson,
    deleteLesson,
    createQuiz,
    updateQuiz,
    deleteQuiz
};
