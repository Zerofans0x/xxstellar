const SibApiV3Sdk = require('sib-api-v3-sdk');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const Settings = require('../models/Settings');
// const Mailjet = require('node-mailjet');
const { SendMailClient } = require("zeptomail"); 

// --- Helper function to render Handlebars templates ---
const renderTemplate = (templateName, data) => {
    const filePath = path.join(__dirname, `../emails/${templateName}.handlebars`);
    const source = fs.readFileSync(filePath, 'utf-8').toString();
    const template = handlebars.compile(source);
    const dataWithYear = { ...data, currentYear: new Date().getFullYear() };
    return template(dataWithYear);
};

// // --- Service 1: Brevo (API-based) ---
// const sendEmailWithBrevo = async (options) => {
//     const defaultClient = SibApiV3Sdk.ApiClient.instance;
//     const apiKey = defaultClient.authentications['api-key'];
//     apiKey.apiKey = process.env.BREVO_API_KEY;

//     const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
//     const sender = {
//         email: options.sent_from.match(/<(.*)>/)[1],
//         name: options.sent_from.replace(/ <.*>/, ''),
//     };
//     const receivers = [{ email: options.send_to }];
//     const htmlContent = renderTemplate(options.template, {
//         name: options.name,
//         link: options.link,
//     });

//     console.log("📧 Sending email via Brevo to:", options.send_to);
//     await tranEmailApi.sendTransacEmail({
//         sender,
//         to: receivers,
//         subject: options.subject,
//         replyTo: { email: options.reply_to },
//         htmlContent: htmlContent,
//     });
// };

// --- Service 2: Nodemailer (SMTP-based) ---
const sendEmailWithNodemailer = async (options) => {
    // ... (Keep existing Nodemailer code) ...
    const transporter = nodemailer.createTransport({
        host: process.env.PSYCHE_EMAIL_HOST,
        port: process.env.PSYCHE_EMAIL_PORT,
        secure: true, 
        auth: {
            user: process.env.PSYCHE_EMAIL_USER,
            pass: process.env.PSYCHE_EMAIL_PASS,
        },
    });

    const htmlContent = renderTemplate(options.template, {
        name: options.name,
        link: options.link,
    });

    console.log("📧 Sending email via Nodemailer SMTP to:", options.send_to);
    await transporter.sendMail({
        from: options.sent_from,
        to: options.send_to,
        replyTo: options.reply_to,
        subject: options.subject,
        html: htmlContent,
    });
};

// // --- Service 3: Mailjet (API-based) ---
// const sendEmailWithMailjet = async (options) => {
//     // ... (Keep existing Mailjet code) ...
//     try {
//         const mailjetClient = Mailjet.apiConnect(
//             process.env.MAILJET_API_KEY, 
//             process.env.MAILJET_SECRET_KEY
//         );

//         const match = options.sent_from.match(/(.*) <(.*)>/);
//         const fromName = match ? match[1].trim() : options.sent_from;
//         const fromEmail = match ? match[2].trim() : options.sent_from;
        
//         const htmlContent = renderTemplate(options.template, {
//             name: options.name,
//             link: options.link,
//         });

//         console.log("📧 Sending email via Mailjet to:", options.send_to);

//         const result = await mailjetClient.post('send', { version: 'v3.1' }).request({
//             Messages: [
//                 {
//                     From: { Email: fromEmail, Name: fromName },
//                     To: [{ Email: options.send_to }],
//                     Subject: options.subject,
//                     HTMLPart: htmlContent,
//                     Headers: { 'Reply-To': options.reply_to },
//                 },
//             ],
//         });
        
//         if (result.response.status !== 200 && result.response.status !== 202) {
//              throw new Error(`Mailjet send failed with status ${result.response.status}`);
//         }

//     } catch (error) {
//         console.error("MAILJET API ERROR:", error.message);
//         throw error;
//     }
// };

// --- 🚀 Service 4: ZeptoMail (Cleaned up Merge Logic) ---
const sendEmailWithZepto = async (options) => {
    try {
        const token = process.env.ZEPTOMAIL_TOKEN; 
        const isTemplate = !!options.templateKey;
        
        const requestUrl = isTemplate 
            ? "https://api.zeptomail.com/v1.1/email/template" 
            : "https://api.zeptomail.com/v1.1/email";

        let client = new SendMailClient({ url: requestUrl, token });

        const match = options.sent_from.match(/(.*) <(.*)>/);
        const fromName = match ? match[1].trim() : "Psychedelia";
        const fromEmail = match ? match[2].trim() : options.sent_from;

        let mailPayload = {
            "from": { "address": fromEmail, "name": fromName },
            "to": [{
                "email_address": {
                    "address": options.send_to,
                    "name": options.name || "Trader"
                }
            }],
            "subject": options.subject || "Notification from Psychedelia", 
            "reply_to": [{ "address": options.reply_to, "name": "Support" }],
        };

        if (isTemplate) {
            mailPayload.template_key = options.templateKey;
            // 🛡️ FIX: Ensure merge_info is a flat object containing everything from extraParams
            mailPayload.merge_info = {
                name: options.name,
                product_name: "Psychedelia", 
                ...options.extraParams
            };
        } else {
            const htmlContent = renderTemplate(options.template, {
                name: options.name,
                ...options.extraParams, // Spread extra params for handlebars too
            });
            mailPayload.htmlbody = htmlContent;
        }

        await client.sendMail(mailPayload);
    } catch (error) {
        console.error("ZEPTOMAIL ERROR:", JSON.stringify(error, null, 2));
        throw error;
    }
};

// --- Main Exported Function ---
const sendEmail = async (options) => {
    const currentSettings = await Settings.findOne({ singleton: 'main_settings' });
    const provider = currentSettings?.emailProvider || 'zeptomail';

    if (provider === 'mailjet') {
        return sendEmailWithMailjet(options);
    } else if (provider === 'brevo') {
        return sendEmailWithBrevo(options);
    } else if (provider === 'zeptomail') {
        return sendEmailWithZepto(options);
    } else {
        return sendEmailWithNodemailer(options);
    }
};


module.exports = { sendEmail };