const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Strategy = require('../models/Strategy');
const connectDB = require('../config/db');

dotenv.config({ path: './.env' });

const fixImages = async () => {
    await connectDB();
    
    // Set a default image for all strategies that don't have one
    const result = await Strategy.updateMany(
        { latestImageUrl: { $exists: false } },
        { $set: { latestImageUrl: "https://placehold.co/1280x720?text=Strategy+Default" } }
    );

    console.log(`Updated ${result.modifiedCount} strategies with default images.`);
    process.exit();
};

fixImages();