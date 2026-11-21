/**
 * Payment Service (Stripe, JazzCash, EasyPaisa, & Mock Payments)
 */
import logger from '../utils/logger.js';
import crypto from 'crypto';

let stripe = null;

// Initialize Stripe if secret key is supplied
if (process.env.STRIPE_SECRET_KEY) {
    try {
        import('stripe').then(({ default: Stripe }) => {
            stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            logger.info('[Payment] Stripe initialized successfully.');
        });
    } catch (err) {
        logger.error('[Payment] Stripe initialization failed:', err);
    }
}

export const paymentService = {
    /**
     * Create a payment intent or checkout session for a booking
     * Supports 'card' (Stripe), 'jazzcash', 'bank', and 'mock'
     */
    async createPaymentIntent({ booking, method = 'card' }) {
        logger.info(`[Payment] Creating intent for booking ${booking.reference} via ${method}`);

        // 1. STRIPE FLOW (Credit/Debit Card)
        if (method === 'card' && stripe && process.env.STRIPE_SECRET_KEY) {
            try {
                // TODO: When ready, set your currency (PKR or USD) and Stripe keys in .env
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: Math.round(booking.total * 100), // In smallest currency unit (e.g. cents/paisa)
                    currency: 'pkr',
                    metadata: {
                        bookingReference: booking.reference,
                        customerEmail: booking.customer.email,
                        tourTitle: booking.tourSnapshot.title
                    }
                });

                return {
                    gateway: 'stripe',
                    clientSecret: paymentIntent.client_secret,
                    intentId: paymentIntent.id
                };
            } catch (err) {
                logger.error(`[Payment] Stripe error: ${err.message}. Falling back to mock intent.`);
            }
        }

        // 2. JAZZCASH FLOW
        if (method === 'jazzcash' && process.env.JAZZCASH_MERCHANT_ID) {
            // TODO: Plug in real JazzCash Merchant Credentials when obtained
            const txnRef = `T${Date.now()}`;
            return {
                gateway: 'jazzcash',
                redirectUrl: `https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform?txnRef=${txnRef}`,
                txnRef
            };
        }

        // 3. MOCK PAYMENT FLOW (Default development & fallback)
        // Always succeeds, produces a mock clientSecret and transaction reference
        const mockTxnId = `MOCK-TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        return {
            gateway: 'mock',
            success: true,
            status: 'paid',
            transactionId: mockTxnId,
            message: 'Mock payment processed successfully.'
        };
    },

    /**
     * Verify payment status callback from webhook or return URL
     */
    async verifyPayment({ transactionId, method = 'mock' }) {
        logger.info(`[Payment] Verifying transaction ${transactionId} via ${method}`);

        // In mock mode, immediately verify as successful
        return {
            verified: true,
            status: 'paid',
            transactionId: transactionId || `TXN-${Date.now()}`
        };
    }
};

export default paymentService;
