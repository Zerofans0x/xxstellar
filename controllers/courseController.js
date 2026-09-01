// controllers/courseController.js
const asyncHandler = require('express-async-handler');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const CourseProgress = require('../models/CourseProgress');
const PsycheProfile = require('../models/PsycheProfile');
const { generateVideoAccessToken } = require('../utils/generateVideoAccessToken');
const jwt = require('jsonwebtoken');
const { getVideoStream } = require('../services/s3Service'); 

// Helper to check if user tier meets course tier
const hasTierAccess = (userTier, requiredTier) => {
    const tierWeights = { 'Basic': 1, 'Pro': 2, 'Ultra': 3 };
    return tierWeights[userTier] >= tierWeights[requiredTier];
};

/**
 * @desc    Generate a short-lived access token for a lesson video
 * @route   POST /api/v1/courses/lessons/:lessonId/access
 * @access  Private
 */
const generateLessonAccess = asyncHandler(async (req, res) => {
    const { lessonId } = req.params;
    
    // 1. Fetch Lesson, Module, and Course to determine access rights
    const lesson = await Lesson.findById(lessonId).populate({
        path: 'module',
        populate: { path: 'course', select: 'requiredTier' }
    });

    if (!lesson) {
        res.status(404); throw new Error('Lesson not found.');
    }

    // 2. Fetch User's Profile/Plan
    const profile = await PsycheProfile.findOne({ user: req.user.id });
    if (!profile) {
        res.status(403); throw new Error('Profile not found. Please complete onboarding.');
    }

    // 3. Authorization Check: Does their plan cover this course?
    const requiredTier = lesson.module.course.requiredTier;
    
    if (!hasTierAccess(profile.planTier, requiredTier)) {
        res.status(403);
        throw new Error(`Access denied. Please upgrade to the ${requiredTier} plan to watch this lesson.`);
    }

    // 4. Progress Check (Figma Screen 7 shows locking/unlocking)
    // Here you would check your 'Progress' model to ensure they passed the previous quiz.

    // 5. Authorization successful!
    const watermarkText = req.user.email; 

    if (lesson.sourceType === 'youtube') {
        res.status(200).json({
            sourceType: 'youtube',
            sourceId: lesson.sourceId,
            watermarkText,
        });
    } else if (lesson.sourceType === 'direct') {
        // Reuse your existing JWT generator
        const accessToken = generateVideoAccessToken(req.user, lesson); 
        const streamUrl = `${process.env.BACKEND_URL}/api/v1/courses/stream/${lesson._id}?token=${accessToken}`;
        
        res.status(200).json({
            sourceType: 'direct',
            streamUrl, 
            watermarkText,
        });
    }
});


// @desc    Get all active courses (Catalog)
// @route   GET /api/v1/courses
// @access  Private
const getCourses = asyncHandler(async (req, res) => {
    // Fetch all active courses, returning just the necessary fields for the catalog grid
    const courses = await Course.find({ isActive: true })
        .select('title slug description category requiredTier thumbnailUrl')
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: courses.length,
        data: courses
    });
});


// @desc    Get a single course with its modules, lessons, and quizzes
const getCourseBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const course = await Course.findOne({ slug, isActive: true });

    if (!course) {
        res.status(404); throw new Error('Course not found');
    }

    const modules = await Module.find({ course: course._id }).sort({ orderIndex: 1 }).lean();

    for (let i = 0; i < modules.length; i++) {
        const lessons = await Lesson.find({ module: modules[i]._id })
            .select('title description orderIndex durationMinutes sourceType resources')
            .sort({ orderIndex: 1 });
            
        const quizzes = await Quiz.find({ module: modules[i]._id })
            .select('title passThreshold orderIndex')
            .sort({ orderIndex: 1 });

        modules[i].lessons = lessons;
        modules[i].quizzes = quizzes; // Attach quizzes to the module payload
    }

    res.status(200).json({ success: true, data: { ...course.toObject(), modules } });
});

// @desc    Stream a directly monetized video from S3, secured by token.
// @route   GET /api/v1/courses/stream/:lessonId
// @access  Private (via token)
const streamLessonVideo = asyncHandler(async (req, res) => {
    const { token } = req.query;
    if (!token) {
        res.status(401); 
        throw new Error('Not authorized, no token.');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const lesson = await Lesson.findById(req.params.lessonId);
        
        // Note: We check decoded.videoId because your generateVideoAccessToken 
        // utility still labels the payload as 'videoId'
        if (!lesson || lesson._id.toString() !== decoded.videoId) {
            res.status(401); 
            throw new Error('Not authorized for this video.');
        }
        
        // Fetch stream from AWS S3
        const { stream, contentType, contentLength } = await getVideoStream(lesson.sourceId);

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': contentLength,
        });

        stream.pipe(res);
    } catch (error) {
        res.status(401); 
        throw new Error('Not authorized, token is invalid or has expired.');
    }
});


// @desc    Get a quiz for taking (removes correct answers from payload)
// @route   GET /api/v1/courses/quizzes/:quizId
// @access  Private
const getQuiz = asyncHandler(async (req, res) => {
    const quiz = await Quiz.findById(req.params.quizId).lean();
    if (!quiz) {
        res.status(404); throw new Error('Quiz not found');
    }

    // Security: Strip out the 'correctOption' and 'explanation' before sending to the frontend
    const sanitizedQuestions = quiz.questions.map(q => ({
        _id: q._id,
        questionText: q.questionText,
        options: q.options
    }));

    res.status(200).json({
        success: true,
        data: {
            _id: quiz._id,
            title: quiz.title,
            module: quiz.module,
            passThreshold: quiz.passThreshold,
            questions: sanitizedQuestions
        }
    });
});

// @desc    Submit quiz answers, grade them, and update user progress
// @route   POST /api/v1/courses/quizzes/:quizId/submit
// @access  Private
const submitQuiz = asyncHandler(async (req, res) => {
    const { answers, timeTaken } = req.body;
    // Expected answers format: [{ questionId: '123', selectedLetter: 'B' }]

    const quiz = await Quiz.findById(req.params.quizId).populate('module');
    if (!quiz) {
        res.status(404); throw new Error('Quiz not found');
    }

    // 1. Grade the Quiz
    let correctCount = 0;
    const totalQuestions = quiz.questions.length;
    const questionsAnswered = answers.length;

    quiz.questions.forEach(question => {
        const userAnswer = answers.find(a => a.questionId.toString() === question._id.toString());
        if (userAnswer && userAnswer.selectedLetter === question.correctOption) {
            correctCount++;
        }
    });

    const scorePercentage = Math.round((correctCount / totalQuestions) * 100);
    const passed = scorePercentage >= quiz.passThreshold;

    // 2. Track Progress in the Database
    const courseId = quiz.module.course;
    let progress = await CourseProgress.findOne({ user: req.user._id, course: courseId });
    
    // Create progress document if this is their first interaction with the course
    if (!progress) {
        progress = new CourseProgress({
            user: req.user._id,
            course: courseId,
            quizAttempts: []
        });
    }

    // Update or insert the quiz attempt
    const attemptIndex = progress.quizAttempts.findIndex(a => a.quiz.toString() === quiz._id.toString());

    if (attemptIndex > -1) {
        // Keep the highest score across all retakes
        if (scorePercentage > progress.quizAttempts[attemptIndex].highestScore) {
            progress.quizAttempts[attemptIndex].highestScore = scorePercentage;
        }
        if (passed) {
            progress.quizAttempts[attemptIndex].passed = true;
        }
        progress.quizAttempts[attemptIndex].lastAttemptTime = timeTaken;
    } else {
        // First attempt
        progress.quizAttempts.push({
            quiz: quiz._id,
            highestScore: scorePercentage,
            passed: passed,
            lastAttemptTime: timeTaken
        });
    }

    await progress.save();

    // 3. Determine the unlock state for the UI
    let unlockedMessage = "Complete current module";
    if (passed) {
        // Find the next module to get the exact unlocked lesson name
        const nextModule = await Module.findOne({ 
            course: courseId, 
            orderIndex: { $gt: quiz.module.orderIndex } 
        }).sort({ orderIndex: 1 });

        if (nextModule) {
            const nextLesson = await Lesson.findOne({ module: nextModule._id }).sort({ orderIndex: 1 });
            if (nextLesson) {
                unlockedMessage = `Lesson ${nextLesson.orderIndex} → ${nextLesson.title}`;
            }
        } else {
            unlockedMessage = "Course Completed!";
        }
    }

    // 4. Send response perfectly formatted for the Figma screens
    res.status(200).json({
        success: true,
        data: {
            resultTitle: passed ? "Strong result" : "Fair result",
            questionsAnswered: `${questionsAnswered} of ${totalQuestions}`,
            correct: correctCount,
            score: `${scorePercentage}%`,
            timeTaken: timeTaken || "0m 0s",
            passThreshold: `${quiz.passThreshold}%`,
            passed,
            unlocked: passed ? unlockedMessage : null
        }
    });
});


module.exports = {
    getCourses,
    getCourseBySlug,
    generateLessonAccess,
    streamLessonVideo,
    getQuiz,
    submitQuiz
};