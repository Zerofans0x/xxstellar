// const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const crypto = require('crypto');
// const User = require('../models/User'); 
// const { uploadExternalImageToCloudinary } = require('../utils/cloudinary');

// passport.use(
//     new GoogleStrategy(
//         {
//             clientID: process.env.GOOGLE_CLIENT_ID,
//             clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//             callbackURL: '/api/v1/auth/google/callback',
//             passReqToCallback: true, 
//         },
//         async (req, accessToken, refreshToken, profile, done) => {
//             try {
//                 const { id, name, emails, photos } = profile;
//                 const email = emails[0].value;
//                 const originalAvatarUrl = photos ? photos[0].value : null;
//                 let avatarUrl = originalAvatarUrl;

//                 // --- CLOUDINARY UPLOAD ---
//                 if (originalAvatarUrl && process.env.CLOUDINARY_API_KEY) {
//                     try {
//                         avatarUrl = await uploadExternalImageToCloudinary(originalAvatarUrl);
//                     } catch (uploadError) {
//                         console.error("Cloudinary upload failed:", uploadError.message);
//                     }
//                 }

//                 // --- INTENT PARSING ---
//                 let userIntent = 'trader'; 
//                 let postAuthPath = '/dashboard'; 
//                 const allowedIntents = ['trader', 'superadmin']; 

//                 if (req.query.state) {
//                     try {
//                         const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString('ascii'));
//                         if (state.intent && allowedIntents.includes(state.intent)) userIntent = state.intent;
//                         if (state.path) postAuthPath = state.path;
//                     } catch (e) {}
//                 }
                
//                 // --- 1. TRY LOGIN VIA GOOGLE ID ---
//                 let user = await User.findOne({ googleId: id });

//                 if (user) {
//                     user.lastLogin = new Date();
//                     user.postAuthPath = postAuthPath;
//                     await user.save();
//                     return done(null, user);
//                 }

//                 // --- 2. TRY LINKING VIA EMAIL (The Fix is Here) ---
//                 const existingEmailUser = await User.findOne({ email });

//                 if (existingEmailUser) {
//                     // Allow linking if previous method was 'local' OR 'google'
//                     if (existingEmailUser.authMethod === 'local' || existingEmailUser.authMethod === 'google') {
                        
//                         // 🟢 FIX: REPAIR MISSING NAMES
//                         // If the existing user has no firstName (due to previous bug), fix it now using their fullName
//                         if (!existingEmailUser.firstName) {
//                             const nameParts = existingEmailUser.fullName.trim().split(/\s+/);
//                             existingEmailUser.firstName = nameParts[0];
//                             existingEmailUser.lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
//                         }

//                         // Update Link Info
//                         existingEmailUser.googleId = id;
                        
//                         // ⚠️ NOTE: We switch authMethod to 'google', but keep passwordHash
//                         // Ensure your Login Controller allows logging in with password 
//                         // even if authMethod is 'google', as long as passwordHash exists.
//                         existingEmailUser.authMethod = 'google'; 
                        
//                         existingEmailUser.isEmailVerified = true; 
//                         existingEmailUser.lastLogin = new Date();
//                         existingEmailUser.postAuthPath = postAuthPath;
                        
//                         if (!existingEmailUser.avatarUrl && avatarUrl) {
//                             existingEmailUser.avatarUrl = avatarUrl;
//                         }

//                         await existingEmailUser.save(); // <--- Now this works because firstName is fixed
//                         return done(null, existingEmailUser);
//                     } else {
//                         return done(new Error(`Email ${email} is linked to ${existingEmailUser.authMethod}, not Google.`), null);
//                     }
//                 }

//                 // --- 3. CREATE NEW USER ---
//                 const firstName = name.givenName || 'User';
//                 const lastName = name.familyName || '';
//                 const fullName = name.displayName || `${firstName} ${lastName}`.trim();
//                 const randomSuffix = crypto.randomBytes(2).toString('hex');
//                 const cleanName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
//                 const userName = `${cleanName}-${randomSuffix}`;

//                 const newUser = await User.create({
//                     googleId: id,
//                     email: email,
//                     firstName, 
//                     lastName, 
//                     fullName, 
//                     userName,
//                     avatarUrl,
//                     authMethod: 'google',
//                     role: userIntent,
//                     isEmailVerified: true,
//                     lastLogin: new Date(),
//                     isTermsAccepted: true,
//                     termsAcceptedAt: new Date(),
//                     termsVersion: '1.0',
//                     postAuthPath
//                 });

//                 return done(null, newUser);

//             } catch (error) {
//                 console.error("Google Auth Error:", error);
//                 return done(error, null);
//             }
//         }
//     )
// );

// passport.serializeUser((user, done) => done(null, user.id));

// passport.deserializeUser(async (id, done) => {
//     try {
//         const user = await User.findById(id);
//         done(null, user);
//     } catch (err) {
//         done(err, null);
//     }
// });


















const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const crypto = require('crypto');
const User = require('../models/User'); 
const { uploadExternalImageToCloudinary } = require('../utils/cloudinary');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/v1/auth/google/callback',
            passReqToCallback: true, 
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                const { id, name, emails, photos } = profile;
                const email = emails[0].value;
                const originalAvatarUrl = photos ? photos[0].value : null;
                let avatarUrl = originalAvatarUrl;

                // --- CLOUDINARY UPLOAD ---
                if (originalAvatarUrl && process.env.CLOUDINARY_API_KEY) {
                    try {
                        avatarUrl = await uploadExternalImageToCloudinary(originalAvatarUrl);
                    } catch (uploadError) {
                        console.error("Cloudinary upload failed:", uploadError.message);
                    }
                }

                // --- INTENT PARSING ---
                let userIntent = 'trader'; 
                let postAuthPath = '/dashboard'; 
                const allowedIntents = ['trader', 'superadmin']; 

                if (req.query.state) {
                    try {
                        const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString('ascii'));
                        if (state.intent && allowedIntents.includes(state.intent)) userIntent = state.intent;
                        if (state.path) postAuthPath = state.path;
                    } catch (e) {}
                }
                
                // --- 1. TRY LOGIN VIA GOOGLE ID ---
                let user = await User.findOne({ googleId: id });

                if (user) {
                    user.lastLogin = new Date();
                    user.postAuthPath = postAuthPath;
                    await user.save();
                    return done(null, user);
                }

                // --- 2. TRY LINKING VIA EMAIL ---
                const existingEmailUser = await User.findOne({ email });

                if (existingEmailUser) {
                    if (existingEmailUser.authMethod === 'local' || existingEmailUser.authMethod === 'google') {
                        
                        // Fix missing names using profile data if fields are empty
                        if (!existingEmailUser.firstName) {
                            existingEmailUser.firstName = name.givenName || 'User';
                        }
                        if (!existingEmailUser.lastName) {
                            existingEmailUser.lastName = name.familyName || '';
                        }

                        // Update Link Info
                        existingEmailUser.googleId = id;
                        existingEmailUser.authMethod = 'google'; 
                        existingEmailUser.isEmailVerified = true; 
                        existingEmailUser.lastLogin = new Date();
                        existingEmailUser.postAuthPath = postAuthPath;
                        
                        if (!existingEmailUser.avatarUrl && avatarUrl) {
                            existingEmailUser.avatarUrl = avatarUrl;
                        }

                        await existingEmailUser.save();
                        return done(null, existingEmailUser);
                    } else {
                        return done(new Error(`Email ${email} is linked to ${existingEmailUser.authMethod}, not Google.`), null);
                    }
                }

                // --- 3. CREATE NEW USER ---
                const firstName = name.givenName || 'User';
                const lastName = name.familyName || '';
                const randomSuffix = crypto.randomBytes(2).toString('hex');
                const cleanName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
                const userName = `${cleanName}-${randomSuffix}`;

                const newUser = await User.create({
                    googleId: id,
                    email: email,
                    firstName, 
                    lastName, 
                    userName,
                    avatarUrl,
                    authMethod: 'google',
                    role: userIntent,
                    isEmailVerified: true,
                    lastLogin: new Date(),
                    postAuthPath
                });

                return done(null, newUser);

            } catch (error) {
                console.error("Google Auth Error:", error);
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});