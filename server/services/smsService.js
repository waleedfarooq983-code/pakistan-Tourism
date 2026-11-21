/**
 * SMS Service (Twilio & Console Fallback)
 */
import logger from '../utils/logger.js';

let twilioClient = null;

// TODO: Plug in your Twilio Account SID, Auth Token and Phone Number in .env
const isTwilioConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
);

if (isTwilioConfigured) {
    try {
        // Dynamically import or load twilio
        import('twilio').then(({ default: twilio }) => {
            twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            logger.info('[SMS] Twilio client initialized successfully.');
        }).catch(err => {
            logger.error('[SMS] Failed to initialize Twilio SDK:', err.message);
        });
    } catch (e) {
        logger.error('[SMS] Twilio initialization exception:', e);
    }
} else {
    logger.info('[SMS] Running in local demo mode. OTPs and SMS messages will be logged to the server console.');
}

export const smsService = {
    /**
     * Send an OTP SMS to a phone number
     * Formats Pakistani phone numbers (e.g. 03001234567 -> +923001234567)
     */
    async sendOTP(phone, code) {
        const normalizedPhone = phone.startsWith('03')
            ? `+92${phone.slice(1)}`
            : phone.startsWith('+') ? phone : `+92${phone}`;

        const messageBody = `[Discover Pakistan] Your verification code is ${code}. Valid for 5 minutes. Do NOT share this code with anyone.`;

        // If Twilio is active and configured
        if (twilioClient && isTwilioConfigured) {
            try {
                const message = await twilioClient.messages.create({
                    body: messageBody,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: normalizedPhone
                });
                logger.info(`[SMS] Twilio message sent to ${normalizedPhone}. SID: ${message.sid}`);
                return { success: true, sid: message.sid };
            } catch (err) {
                logger.error(`[SMS] Twilio failed to deliver to ${normalizedPhone}: ${err.message}`);
                // Fall back to console print
            }
        }

        // Prominent server console output for development & testing
        console.log('\n================================================================');
        console.log(`📱 [SMS SERVICE SIMULATION]`);
        console.log(`To Phone Number : ${phone} (${normalizedPhone})`);
        console.log(`Message Content : ${messageBody}`);
        console.log(`🔑 OTP CODE     : >>>  ${code}  <<<`);
        console.log('================================================================\n');

        return { success: true, simulated: true };
    }
};

export default smsService;
