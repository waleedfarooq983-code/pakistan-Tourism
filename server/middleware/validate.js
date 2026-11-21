/**
 * Zod Input Validation & Sanitization Middleware
 */
import sanitizeHtml from 'sanitize-html';

// Recursively sanitize all strings inside an object to strip unwanted HTML tags
export const sanitizeInputs = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeInputs(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            // Strip HTML tags and clean up string
            sanitized[key] = sanitizeHtml(value, {
                allowedTags: [],
                allowedAttributes: {}
            }).trim();
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeInputs(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};

/**
 * Creates an Express middleware that validates req.body, req.query, or req.params using a Zod schema
 * @param {import('zod').ZodSchema} schema 
 */
export const validate = (schema) => async (req, res, next) => {
    try {
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeInputs(req.body);
        }

        const dataToValidate = {
            body: req.body,
            query: req.query,
            params: req.params
        };

        const parsed = await schema.parseAsync(dataToValidate);

        // Replace request attributes with parsed & typed values if schema explicitly targeted them
        if (parsed.body) req.body = parsed.body;
        if (parsed.query) req.query = parsed.query;
        if (parsed.params) req.params = parsed.params;

        next();
    } catch (err) {
        if (err.errors) {
            const formattedErrors = err.errors.map(e => ({
                field: e.path.join('.').replace(/^(body|query|params)\./, ''),
                message: e.message
            }));

            return res.status(400).json({
                success: false,
                message: formattedErrors[0]?.message || 'Validation failed',
                errors: formattedErrors
            });
        }

        return res.status(400).json({
            success: false,
            message: err.message || 'Invalid input data'
        });
    }
};

export default validate;
