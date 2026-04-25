const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const axios = require('axios');

const SARVAM_BASE = 'https://api.sarvam.ai/speech-to-text/job/v1';

function getSarvamApiKey() {
  return (
    process.env.SARVAM_API_KEY ||
    process.env.SARVAM_API_SUBSCRIPTION_KEY ||
    process.env.SARVAM_SUBSCRIPTION_KEY ||
    ''
  ).trim();
}

function getSarvamHeaders() {
  const apiKey = getSarvamApiKey();
  return {
    'api-subscription-key': apiKey,
    'Content-Type': 'application/json',
  };
}

function buildTranscribeError(err) {
  const status = err?.response?.status;
  const detail =
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.response?.data?.detail ||
    err?.message;

  if (!getSarvamApiKey()) {
    return {
      statusCode: 503,
      detail: 'Transcription service is not configured. Set SARVAM_API_KEY on the backend server.',
    };
  }

  if (status === 401 || status === 403) {
    return {
      statusCode: 502,
      detail: 'Sarvam API authentication failed. Check the backend SARVAM_API_KEY configuration.',
    };
  }

  return {
    statusCode: 500,
    detail: detail || 'Transcription failed',
  };
}

// Convert any audio/video to 16kHz mono WAV
function convertToWav(inputPath, outputPath) {
  execSync(
    `ffmpeg -y -i "${inputPath}" -vn -ar 16000 -ac 1 -f wav "${outputPath}"`,
    { stdio: 'pipe' }
  );
}

// Get audio duration in seconds via ffprobe
function getDurationSecs(wavPath) {
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${wavPath}"`,
    { stdio: 'pipe' }
  ).toString().trim();
  return parseFloat(out);
}

// Split WAV into chunks of at most maxSecs seconds
function splitWav(wavPath, maxSecs) {
  const totalSecs = getDurationSecs(wavPath);
  if (totalSecs <= maxSecs) return [wavPath];

  const numChunks = Math.ceil(totalSecs / maxSecs);
  const chunks = [];
  for (let i = 0; i < numChunks; i++) {
    const chunkPath = wavPath.replace('.wav', `_chunk${i}.wav`);
    execSync(
      `ffmpeg -y -i "${wavPath}" -ss ${i * maxSecs} -t ${maxSecs} -c copy "${chunkPath}"`,
      { stdio: 'pipe' }
    );
    chunks.push(chunkPath);
  }
  return chunks;
}

// Full Sarvam batch flow for a single WAV chunk
async function batchTranscribeChunk(wavPath, language) {
  const filename = path.basename(wavPath);
  const sarvamHeaders = getSarvamHeaders();

  if (!sarvamHeaders['api-subscription-key']) {
    throw new Error('Transcription service is not configured. Set SARVAM_API_KEY on the backend server.');
  }

  // 1. Create job
  const { data: jobData } = await axios.post(
    SARVAM_BASE,
    { job_parameters: { language_code: language || 'unknown', model: 'saarika:v2.5', with_timestamps: false } },
    { headers: sarvamHeaders, timeout: 30000 }
  );
  const jobId = jobData.job_id;

  // 2. Get presigned upload URL
  const { data: uploadData } = await axios.post(
    `${SARVAM_BASE}/upload-files`,
    { job_id: jobId, files: [filename] },
    { headers: sarvamHeaders, timeout: 30000 }
  );
  const presignedUrl = uploadData.upload_urls[filename].file_url;

  // 3. Upload the WAV file to the presigned URL
  const fileBuffer = fs.readFileSync(wavPath);
  await axios.put(presignedUrl, fileBuffer, {
    headers: { 'Content-Type': 'audio/wav' },
    maxBodyLength: Infinity,
    timeout: 120000,
  });

  // 4. Start the job
  await axios.post(
    `${SARVAM_BASE}/start`,
    { job_id: jobId },
    { headers: sarvamHeaders, timeout: 30000 }
  );

  // 5. Poll until completed or failed (max 10 minutes)
  const pollStart = Date.now();
  let jobState = '';
  while (Date.now() - pollStart < 600_000) {
    await new Promise(r => setTimeout(r, 5000));
    const { data: statusData } = await axios.get(
      `${SARVAM_BASE}/${jobId}`,
      { headers: sarvamHeaders, timeout: 30000 }
    );
    jobState = statusData.job_state;
    if (jobState === 'Completed') break;
    if (jobState === 'Failed') throw new Error(`Sarvam batch job failed: ${statusData.error_message || 'unknown error'}`);
  }
  if (jobState !== 'Completed') throw new Error('Transcription job timed out');

  // 6. Get download URL for the result
  const { data: dlData } = await axios.get(
    `${SARVAM_BASE}/${jobId}/download`,
    { headers: sarvamHeaders, timeout: 30000 }
  );
  const downloadUrl = dlData.download_urls[filename].file_url;

  // 7. Fetch the transcript JSON
  const { data: transcriptData } = await axios.get(downloadUrl, { timeout: 60000 });
  return transcriptData.transcript || '';
}

const transcribeMedia = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  if (!getSarvamApiKey()) {
    return res.status(503).json({
      message: 'Transcription service is not configured',
      detail: 'Set SARVAM_API_KEY on the backend server and restart the backend.',
    });
  }

  const tmpDir = os.tmpdir();
  const ts = Date.now();
  const inputPath = path.join(tmpDir, `tr_input_${ts}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  const wavPath = path.join(tmpDir, `tr_wav_${ts}.wav`);
  let chunkPaths = [];

  try {
    fs.writeFileSync(inputPath, req.file.buffer);
    convertToWav(inputPath, wavPath);

    const language = req.body.language || 'unknown';

    // Split into ≤25s chunks (well under the 30s API limit)
    const chunks = splitWav(wavPath, 25);
    if (chunks.length > 1) chunkPaths = chunks.filter(c => c !== wavPath);

    const transcripts = [];
    for (const chunk of chunks) {
      const text = await batchTranscribeChunk(chunk, language);
      transcripts.push(text);
    }

    return res.json({ transcript: transcripts.join(' ').trim() });
  } catch (err) {
    const handled = buildTranscribeError(err);
    console.error('[Transcribe] Error:', err.response?.data || err.message);
    return res.status(handled.statusCode).json({
      message: 'Transcription failed',
      detail: handled.detail,
    });
  } finally {
    [inputPath, wavPath, ...chunkPaths].forEach(f => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
    });
  }
};

module.exports = { transcribeMedia };
