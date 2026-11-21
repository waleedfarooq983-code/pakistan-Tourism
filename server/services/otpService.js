/**
 * OTP Service
 * Handles generation, hashing, database storage, rate limiting, and verification
 */
import OTP from '../models/OTP.js';
import generateOTP from '../utils/generateOTP.js';
import emailService from './emailService.js';
import smsService from './smsService.js';
import logger from '../utils/logger.js';

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 3;

export const otpService = {
    /**
     * Creates an OTP, saves it in DB hashed, and sends via email (and SMS if phone provided)
     */
    async createAndSendOTP({ target, purpose = 'signup', phone = null }) {
        const normalizedTarget = target.toLowerCase().trim();

        // Check hourly rate limit: count OTPs created for this target in the last 60 minutes
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentSendsCount = await OTP.countDocuments({
            target: normalizedTarget,
            createdAt: { $gte: oneHourAgo }
        });

        if (recentSendsCount >= MAX_SENDS_PER_HOUR) {
            throw new Error(`Rate limit exceeded. Maximum ${MAX_SENDS_PER_HOUR} verification codes per hour. Please wait before requesting another.`);
        }

        // Generate 6-digit code
        const code = generateOTP(6);
        const codeHash = await OTP.hashCode(code);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        // Invalidate any prior unverified OTPs for this target & purpose
        await OTP.deleteMany({ target: normalizedTarget, purpose });

        // Save new OTP
        await OTP.create({
            target: normalizedTarget,
            codeHash,
            purpose,
            expiresAt,
            attempts: 0,
            verified: false
        });

        logger.info(`[OTP] Generated for ${normalizedTarget} [Purpose: ${purpose}]`);

        // Prominent console log for testing / inspection in Railway terminal logs
        console.log('\n======================================================');
        console.log(`🔐 [DISCOVER PAKISTAN - OTP VERIFICATION CODE]`);
        console.log(`👉 Target:   ${normalizedTarget}`);
        console.log(`👉 Purpose:  ${purpose}`);
        console.log(`👉 CODE:     >>> ${code} <<<`);
        console.log(`👉 Expires:  ${OTP_EXPIRY_MINUTES} minutes`);
        console.log('======================================================\n');

        // Send Email (Nodemailer wrapped in try...catch so email delay or failure NEVER breaks signup)
        let emailResult = null;
        if (normalizedTarget.includes('@')) {
            try {
                const emailPromise = (purpose === 'reset')
                    ? emailService.sendPasswordResetEmail(normalizedTarget, code)
                    : emailService.sendOTPEmail(normalizedTarget, code, purpose);

                // Allow up to 1.5s for fast SMTP delivery; if it takes longer, let it complete in background
                emailResult = await Promise.race([
                    emailPromise,
                    new Promise(resolve => setTimeout(() => resolve({ simulated: false, pending: true }), 1500))
                ]);
            } catch (mailError) {
                console.error(`⚠️ [Nodemailer sendMail Error]: ${mailError.message}`);
                logger.error(`[Email] Failed to send email to ${normalizedTarget}: ${mailError.message}`);
            }
        }

        // Send SMS if phone provided or target is phone
        if (phone || (!normalizedTarget.includes('@') && /^\d+$/.test(normalizedTarget))) {
            try {
                const smsTarget = phone || normalizedTarget;
                await smsService.sendOTP(smsTarget, code);
            } catch (smsError) {
                console.error(`⚠️ [SMS send Error]: ${smsError.message}`);
            }
        }

        return {
            success: true,
            code,
            debug_otp: code,
            expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
            previewUrl: emailResult?.previewUrl || null,
            demoCode: code
        };
    },

    /**
     * Verifies an OTP code for a given target and purpose
     */
    async verifyOTP({ target, code, purpose }) {
        const normalizedTarget = target.toLowerCase().trim();
        const cleanCode = code ? String(code).trim() : '';

        const record = await OTP.findOne({
            target: normalizedTarget,
            purpose
        }).sort({ createdAt: -1 });

        if (!record) {
            throw new Error('No active verification code found. Please request a new code.');
        }

        if (record.verified) {
            throw new Error('This verification code has already been used.');
        }

        if (new Date() > record.expiresAt) {
            await OTP.deleteOne({ _id: record._id });
            throw new Error('Verification code has expired. Please request a new one.');
        }

        if (record.attempts >= MAX_ATTEMPTS) {
            await OTP.deleteOne({ _id: record._id });
            throw new Error('Maximum verification attempts exceeded. Please request a new code.');
        }

        const isMatch = await record.compareCode(cleanCode);

        if (!isMatch) {
            record.attempts += 1;
            await record.save();
            const attemptsLeft = MAX_ATTEMPTS - record.attempts;
            throw new Error(`Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`);
        }

        // Mark as verified and delete to prevent replay
        record.verified = true;
        await record.save();
        await OTP.deleteOne({ _id: record._id });

        return true;
    }
};

export default otpService;
