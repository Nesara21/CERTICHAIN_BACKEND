const { logger } = require('./logger');

/**
 * Retries a function with exponential backoff.
 * @param {Function} fn - The async function to retry.
 * @param {number} attempts - Maximum number of attempts.
 * @param {number} baseMs - Base delay in milliseconds.
 * @returns {Promise<any>} - The result of the function.
 */
async function retryWithBackoff(fn, attempts = 3, baseMs = 1000) {
    let lastError;

    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            logger.warn(`Attempt ${i + 1} failed: ${error.message}`);

            if (i < attempts - 1) {
                const delay = baseMs * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    logger.error(`All ${attempts} attempts failed.`);
    throw lastError;
}

module.exports = { retryWithBackoff };
