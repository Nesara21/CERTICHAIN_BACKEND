const db = require('../database');
const { logger } = require('./logger');

/**
 * Middleware to handle idempotency.
 * Checks for Idempotency-Key header.
 * If key exists and response is cached, returns cached response.
 * If key exists and is locked, returns 409 Conflict (processing).
 * If key is new, proceeds and caches response on finish.
 */
const idempotency = async (req, res, next) => {
    const key = req.headers['idempotency-key'];

    if (!key) {
        return next();
    }

    try {
        // Check if key exists
        const [rows] = await db.execute('SELECT * FROM idempotency_keys WHERE `key` = ?', [key]);

        if (rows.length > 0) {
            const record = rows[0];

            if (record.locked) {
                return res.status(409).json({ error: 'Request is currently being processed' });
            }

            if (record.response) {
                req.log.info('Returning cached response for idempotency key');
                return res.json(JSON.parse(record.response));
            }
        } else {
            // Create lock
            await db.execute('INSERT INTO idempotency_keys (`key`, `locked`) VALUES (?, ?)', [key, true]);
        }

        // Hook into response to cache result
        const originalJson = res.json;
        res.json = function (body) {
            // Restore original json function to avoid infinite loop if we call it again
            res.json = originalJson;

            // Cache response asynchronously
            db.execute('UPDATE idempotency_keys SET response = ?, locked = ? WHERE `key` = ?', [JSON.stringify(body), false, key])
                .catch(err => logger.error(`Failed to cache idempotency response: ${err.message}`));

            return originalJson.call(this, body);
        };

        next();

    } catch (err) {
        logger.error(`Idempotency error: ${err.message}`);
        next(); // Proceed without idempotency if DB fails? Or fail safe? Let's fail safe for now.
    }
};

module.exports = { idempotency };
