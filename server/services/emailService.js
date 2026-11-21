/**
 * Email Service
 * Uses Nodemailer with SMTP credentials (SendGrid, Mailgun, etc.)
 * Defaults automatically to Ethereal Email for testing if no credentials provided!
 */
import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

let transporter = null;
let isEthereal = false;

async function getTransporter() {
    if (transporter) return transporter;

    // TODO: Plug in your production SMTP credentials here or via environment variables
    const hasSmtpCreds = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    if (hasSmtpCreds) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        isEthereal = false;
        logger.info('[Email] Using configured SMTP server:', process.env.SMTP_HOST);
    } else {
        // Fallback: Create test account on Ethereal
        try {
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            isEthereal = true;
            logger.info('[Email] Using Ethereal test account for email previews:', testAccount.user);
        } catch (e) {
            logger.error('[Email] Failed to create Ethereal test account. Emails will only log to console.', e);
        }
    }

    return transporter;
}

export const emailService = {
    /**
     * Sends an email and prints the Ethereal preview URL if applicable
     */
    async sendMail({ to, subject, html, text }) {
        try {
            const mailer = await getTransporter();
            const from = process.env.SMTP_FROM || '"Discover Pakistan" <no-reply@discoverpakistan.pk>';

            if (!mailer) {
                console.log(`[EMAIL LOG ONLY]\nTo: ${to}\nSubject: ${subject}\nContent:\n${text || html}\n`);
                return { success: true, simulated: true };
            }

            const info = await mailer.sendMail({
                from,
                to,
                subject,
                text: text || '',
                html: html || ''
            });

            logger.info(`[Email] Sent to ${to} (MessageId: ${info.messageId})`);

            if (isEthereal) {
                const previewUrl = nodemailer.getTestMessageUrl(info);
                console.log('\n📬 [EMAIL PREVIEW URL] ---------------------------------------------');
                console.log(`To: ${to}`);
                console.log(`Subject: ${subject}`);
                console.log(`Preview: ${previewUrl}`);
                console.log('--------------------------------------------------------------------\n');
                return { success: true, messageId: info.messageId, previewUrl };
            }

            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error(`[Email] Failed to send email to ${to}: ${error.message}`);
            return { success: false, error: error.message };
        }
    },

    /**
     * Send OTP verification email for signup or login
     */
    async sendOTPEmail(email, code, purpose = 'signup') {
        const purposeText = purpose === 'signup' ? 'verify your registration' : 'log into your account';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e1e8ed; border-radius: 12px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #0a6b3a; margin-bottom: 4px;">Discover Pakistan</h1>
                    <p style="color: #7f8c8d; font-size: 14px;">Official Tourism E-Portal</p>
                </div>
                <div style="background: #f7faf8; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #1a202c; font-size: 18px; margin-bottom: 12px;">Your One-Time Passcode (OTP)</h2>
                    <p style="color: #4a5568; font-size: 14px;">Use the following 6-digit code to ${purposeText}:</p>
                    <div style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0a6b3a; background: #ffffff; padding: 12px 28px; border-radius: 8px; border: 2px dashed #0a6b3a; margin: 16px 0;">
                        ${code}
                    </div>
                    <p style="color: #e0435c; font-size: 12px; margin-top: 8px;">⏳ This code expires in 5 minutes. Never share this code with anyone.</p>
                </div>
                <p style="color: #a0aec0; font-size: 12px; text-align: center;">If you did not request this verification, please safely ignore this email.</p>
            </div>
        `;
        return this.sendMail({
            to: email,
            subject: `Your Discover Pakistan Verification Code: ${code}`,
            html,
            text: `Your Discover Pakistan verification code is: ${code}. It expires in 5 minutes.`
        });
    },

    /**
     * Send Password Reset Email with OTP
     */
    async sendPasswordResetEmail(email, code) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e1e8ed; border-radius: 12px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #0a6b3a; margin-bottom: 4px;">Discover Pakistan</h1>
                    <p style="color: #7f8c8d; font-size: 14px;">Account Security</p>
                </div>
                <div style="background: #fff8e7; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px; border: 1px solid #c9a24c;">
                    <h2 style="color: #8c6b1f; font-size: 18px; margin-bottom: 12px;">Password Reset Request</h2>
                    <p style="color: #4a5568; font-size: 14px;">Enter this 6-digit code on the reset password screen:</p>
                    <div style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #8c6b1f; background: #ffffff; padding: 12px 28px; border-radius: 8px; border: 2px dashed #c9a24c; margin: 16px 0;">
                        ${code}
                    </div>
                    <p style="color: #c0392b; font-size: 12px; margin-top: 8px;">⏳ Valid for 5 minutes. If you did not request this, please change your password immediately.</p>
                </div>
            </div>
        `;
        return this.sendMail({
            to: email,
            subject: `Discover Pakistan — Password Reset Code: ${code}`,
            html,
            text: `Your password reset code is ${code}. It expires in 5 minutes.`
        });
    },

    /**
     * Send Booking Confirmation Email
     */
    async sendBookingConfirmation(booking) {
        const fmtPrice = (n) => `PKR ${Number(n).toLocaleString()}`;
        const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e1e8ed; border-radius: 12px; background: #ffffff;">
                <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #0a6b3a;">
                    <h1 style="color: #0a6b3a; margin: 0;">Discover Pakistan</h1>
                    <p style="color: #27ae60; font-weight: bold; margin: 6px 0 0;">Booking Confirmed! 🎉</p>
                </div>
                <div style="padding: 20px 0;">
                    <p style="color: #2d3748; font-size: 15px;">Dear <strong>${booking.customer.name}</strong>,</p>
                    <p style="color: #4a5568; font-size: 14px; line-height: 1.6;">Thank you for booking with Discover Pakistan! Your tour is confirmed. Here are the details of your upcoming adventure:</p>

                    <div style="background: #f7faf8; border-radius: 8px; padding: 18px; margin: 20px 0; border-left: 4px solid #0a6b3a;">
                        <div style="font-size: 12px; color: #718096; text-transform: uppercase; font-weight: bold;">Booking Reference</div>
                        <div style="font-size: 20px; font-weight: bold; color: #0a6b3a; letter-spacing: 1px;">${booking.reference}</div>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                        <tr style="border-bottom: 1px solid #edf2f7;">
                            <td style="padding: 10px 0; color: #718096;">Tour</td>
                            <td style="padding: 10px 0; font-weight: bold; text-align: right; color: #1a202c;">${booking.tourSnapshot.title}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #edf2f7;">
                            <td style="padding: 10px 0; color: #718096;">Departure Date</td>
                            <td style="padding: 10px 0; font-weight: bold; text-align: right; color: #1a202c;">${fmtDate(booking.date)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #edf2f7;">
                            <td style="padding: 10px 0; color: #718096;">Duration</td>
                            <td style="padding: 10px 0; font-weight: bold; text-align: right; color: #1a202c;">${booking.tourSnapshot.duration}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #edf2f7;">
                            <td style="padding: 10px 0; color: #718096;">Travelers</td>
                            <td style="padding: 10px 0; font-weight: bold; text-align: right; color: #1a202c;">${booking.adults} Adults${booking.children ? `, ${booking.children} Children` : ''}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #edf2f7;">
                            <td style="padding: 10px 0; color: #718096;">Payment Method</td>
                            <td style="padding: 10px 0; font-weight: bold; text-align: right; text-transform: uppercase; color: #1a202c;">${booking.paymentMethod}</td>
                        </tr>
                        <tr>
                            <td style="padding: 14px 0; font-size: 16px; font-weight: bold; color: #1a202c;">Total Paid</td>
                            <td style="padding: 14px 0; font-size: 18px; font-weight: bold; color: #0a6b3a; text-align: right;">${fmtPrice(booking.total)}</td>
                        </tr>
                    </table>

                    <div style="background: #ebf8ff; border-radius: 8px; padding: 14px; font-size: 13px; color: #2b6cb0;">
                        ℹ️ <strong>Next Steps:</strong> Our support team will call you at ${booking.customer.phone} within 24 hours to confirm pickup locations and answer any travel queries.
                    </div>
                </div>
            </div>
        `;

        return this.sendMail({
            to: booking.customer.email,
            subject: `Booking Confirmed: ${booking.tourSnapshot.title} (${booking.reference})`,
            html,
            text: `Booking Confirmed!\nTour: ${booking.tourSnapshot.title}\nRef: ${booking.reference}\nDate: ${fmtDate(booking.date)}\nTotal: ${fmtPrice(booking.total)}`
        });
    },

    /**
     * Send Admin Notification when contact form is submitted
     */
    async sendAdminContactNotification(message) {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@discoverpakistan.pk';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 580px; padding: 20px;">
                <h3 style="color: #0a6b3a;">New Contact Message Received</h3>
                <p><strong>From:</strong> ${message.name} (${message.email})</p>
                <p><strong>Phone:</strong> ${message.phone || 'N/A'}</p>
                <p><strong>Subject:</strong> ${message.subject}</p>
                <div style="padding: 12px; background: #f7faf8; border-left: 3px solid #0a6b3a; margin-top: 10px;">
                    ${message.message}
                </div>
            </div>
        `;
        return this.sendMail({
            to: adminEmail,
            subject: `[New Inquiry] ${message.subject} - from ${message.name}`,
            html,
            text: `New message from ${message.name} (${message.email}):\n${message.message}`
        });
    }
};

export default emailService;
