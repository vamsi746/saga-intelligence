const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'eu-north-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const BUCKET = process.env.AWS_BUCKET_NAME;
const TELEGRAM_FOLDER = 'telegram-media';

/**
 * Upload a buffer to S3 for Telegram media.
 */
const uploadToS3 = async (buffer, key, contentType = 'application/octet-stream') => {
    await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    }));

    const url = `https://${BUCKET}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${key}`;
    return { url, key };
};

/**
 * Check if a file already exists in S3.
 */
const existsInS3 = async (key) => {
    try {
        await s3Client.send(new HeadObjectCommand({
            Bucket: BUCKET,
            Key: key
        }));
        return true;
    } catch (err) {
        if (err.name === 'NotFound') return false;
        return false;
    }
};

/**
 * Generate a consistent S3 key for Telegram media.
 */
const getTelegramS3Key = (groupId, messageId, fileId, extension = 'dat') => {
    return `${TELEGRAM_FOLDER}/${groupId}/${messageId}_${fileId}.${extension}`;
};

module.exports = {
    uploadToS3,
    existsInS3,
    getTelegramS3Key
};
