const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { retryWithBackoff } = require('../lib/retry');
const { logger } = require('../lib/logger');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

/**
 * Uploads a buffer to S3 with retry.
 * @param {Buffer} buffer - The file content.
 * @param {string} key - The S3 object key.
 * @param {string} contentType - The MIME type.
 * @returns {Promise<string>} - The S3 URL (or key).
 */
async function uploadToS3(buffer, key, contentType = 'application/pdf') {
    if (!BUCKET_NAME) {
        throw new Error('AWS_S3_BUCKET_NAME is not defined');
    }

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType
    });

    await retryWithBackoff(async () => {
        await s3Client.send(command);
    }, 3, 1000);

    const url = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
    logger.info(`Uploaded to S3: ${url}`);
    return url;
}

module.exports = { uploadToS3 };
