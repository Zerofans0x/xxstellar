const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const CourseProgress = require('../models/CourseProgress');
const Lesson = require('../models/Lesson');

// @desc    Get Student Dashboard Home Data
// @route   GET /api/v1/student/dashboard
// @access  Private
const getDashboardHome = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // 1. Fetch User Data
    const user = await User.findById(userId).select('firstName streak createdAt');
    
    // 2. Calculate Greeting
    const currentHour = new Date().getHours();
    let greeting = 'Good Evening';
    if (currentHour < 12) greeting = 'Good Morning';
    else if (currentHour < 18) greeting = 'Good Afternoon';

    // 3. Fetch all active course progress for the user
    // Sorting by updatedAt -1 puts the course they most recently interacted with at index 0
    const allProgress = await CourseProgress.find({ user: userId })
        .populate('course', 'title category totalLessons') // Assuming Course has title, category, totalLessons
        .populate('currentLesson', 'title orderIndex durationMinutes')
        .sort({ updatedAt: -1 })
        .lean();

    // ==========================================
    // 🛑 EMPTY STATE (No courses started yet)
    // ==========================================
    if (!allProgress || allProgress.length === 0) {
        return res.status(200).json({
            success: true,
            data: {
                header: {
                    greeting: greeting,
                    name: user.firstName,
                    streak: user.streak || 0
                },
                metrics: {
                    coursesStarted: { value: 0, subLabel: "of 0 in your path" },
                    lessonsDoneWeek: { value: 0, subLabel: "0 this week" },
                    completionRate: { value: 0, subLabel: "0% up from last week" },
                    accuracyRate: { value: 0, subLabel: "0% up from last week" } 
                },
                currentCourse: null,
                upNext: [],
                activityChart: [] // You will need an ActivityLog schema for real chart data later
            }
        });
    }

    // ==========================================
    // 🟢 ACTIVE STATE
    // ==========================================
    
    // The course they are currently working on is the most recently updated one
    const activeCourse = allProgress[0];
    
    // Calculate aggregate metrics across all their started courses
    const totalCoursesStarted = allProgress.length;
    const totalLessonsCompleted = allProgress.reduce((sum, prog) => sum + (prog.completedLessons?.length || 0), 0);
    
    // Calculate average completion rate
    const avgCompletion = allProgress.reduce((sum, prog) => sum + (prog.completionPercentage || 0), 0) / totalCoursesStarted;

    // 4. Fetch the "Up Next" Lessons
    // We look for lessons in the current module with an orderIndex >= the current lesson
    let upcomingLessons = [];
    if (activeCourse.currentModule && activeCourse.currentLesson) {
        upcomingLessons = await Lesson.find({ 
            module: activeCourse.currentModule,
            orderIndex: { $gte: activeCourse.currentLesson.orderIndex }
        })
        .sort({ orderIndex: 1 })
        .limit(3)
        .lean();
    }

    // Format the "Up Next" array for the frontend
    const formattedUpNext = upcomingLessons.map((lesson, index) => ({
        id: lesson._id,
        title: lesson.title,
        // If it's index 0, it's the current lesson (unlocked and playable). Otherwise, lock it.
        subtitle: index === 0 ? `Lesson ${lesson.orderIndex} • ${activeCourse.completionPercentage}% complete` : `${lesson.durationMinutes || 0} min`,
        isLocked: index !== 0, 
        isPlayable: index === 0
    }));

    res.status(200).json({
        success: true,
        data: {
            header: {
                greeting: greeting,
                name: user.firstName,
                streak: user.streak || 0
            },
            metrics: {
                coursesStarted: { value: totalCoursesStarted, subLabel: "in your path" },
                lessonsDoneWeek: { value: totalLessonsCompleted, subLabel: "lifetime lessons" }, // Updated to lifetime since we don't have a weekly timestamp array yet
                completionRate: { value: Math.round(avgCompletion), subLabel: "average completion" },
                accuracyRate: { value: 0, subLabel: "Quiz data pending" } // Placeholder until quiz aggregation is built
            },
            currentCourse: {
                category: activeCourse.course?.category || "Course",
                title: activeCourse.course?.title || "Untitled Course",
                progressText: `Lesson ${activeCourse.currentLesson?.orderIndex || 1} • ${Math.round(activeCourse.completionPercentage)}% complete`,
                progressPercent: Math.round(activeCourse.completionPercentage)
            },
            upNext: formattedUpNext,
            
            // Note: Chart data requires a dedicated time-series ActivityLog schema to track daily watch hours.
            activityChart: [
                { day: "Monday", hours: 0 },
                { day: "Tuesday", hours: 0 },
                { day: "Wednesday", hours: 0 },
                { day: "Thursday", hours: 0 },
                { day: "Friday", hours: 0 },
                { day: "Saturday", hours: 0 },
                { day: "Sunday", hours: 0 }
            ]
        }
    });
});

module.exports = { getDashboardHome };