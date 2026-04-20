const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const path = require('path');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.AWS_BUCKET_NAME;
const STORIES_FOLDER = 'instagram-stories';
const MEDIA_DOWNLOAD_URL = process.env.MEDIA_ANALYZER_URL || 'http://localhost:8005';

/**
 * Download media via Python Service (handles auth/signatures)
 */
const downloadViaPythonService = async (mediaUrl) => {
  try {
    // 1. Request download
    const dlRes = await axios.post(`${MEDIA_DOWNLOAD_URL}/download`, {
        media_url: mediaUrl
    });
    
    if (!dlRes.data || !dlRes.data.download_url) throw new Error("No download URL returned");

    // 2. Fetch file content
    const fileUrl = `${MEDIA_DOWNLOAD_URL}${dlRes.data.download_url}`;
    const fileRes = await axios({
        method: 'GET',
        url: fileUrl,
        responseType: 'arraybuffer',
        timeout: 60000 
    });
    
    return {
        buffer: Buffer.from(fileRes.data),
        contentType: fileRes.headers['content-type']
    };
  } catch (err) {
      // console.error(`[StoryS3] Python download failed: ${err.message}`); 
      // Silent fail to allow fallback
      return null;
  }
}

/**
 * Upload a buffer or stream to S3 for story archival.
 */
const uploadStoryToS3 = async (buffer, filename, contentType = 'application/octet-stream') => {
  const key = `${STORIES_FOLDER}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  const url = `https://${BUCKET}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${key}`;

  return { url, key };
};

/**
 * Download media from a URL and upload it to S3.
 * Returns { url, key } on success, null on failure.
 */
const archiveStoryMedia = async (mediaUrl, storyPk, mediaType = 'image', suffix = '') => {
  if (!mediaUrl || !BUCKET) return null;

  try {
    let buffer, contentType;

    // 1. Try Python Download Service first (Required for robust Stories/Reels fetching)
    const pyDl = await downloadViaPythonService(mediaUrl);
    
    if (pyDl) {
        buffer = pyDl.buffer;
        contentType = pyDl.contentType;
    } else {
        // 2. Fallback to direct download (Node.js Service)
        const response = await axios({
        method: 'GET',
        url: mediaUrl,
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        });
        buffer = Buffer.from(response.data);
        contentType = response.headers['content-type'] || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
    }

    const ext = mediaType === 'video' ? 'mp4' : 'jpg';
    const filename = `${storyPk}${suffix}.${ext}`;

    const result = await uploadStoryToS3(buffer, filename, contentType);
    console.log(`[StoryS3] ✅ Archived story ${storyPk}${suffix} → ${result.key}`);
    return result;
  } catch (error) {
    console.error(`[StoryS3] ❌ Failed to archive story ${storyPk}${suffix}:`, error.message);
    return null;
  }
};

/**
 * Delete a story's media from S3.
 */
const deleteStoryFromS3 = async (s3Key) => {
  if (!s3Key || !BUCKET) return false;

  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: s3Key
    }));
    console.log(`[StoryS3] 🗑️ Deleted ${s3Key}`);
    return true;
  } catch (error) {
    console.error(`[StoryS3] ❌ Delete failed for ${s3Key}:`, error.message);
    return false;
  }
};

/**
 * Check if a story media file exists in S3.
 */
const storyExistsInS3 = async (s3Key) => {
  if (!s3Key || !BUCKET) return false;

  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: s3Key
    }));
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  uploadStoryToS3,
  archiveStoryMedia,
  deleteStoryFromS3,
  storyExistsInS3,
};
