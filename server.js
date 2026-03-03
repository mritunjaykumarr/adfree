const express = require('express');
const cors = require('cors');
const https = require('https');
const { exec } = require('child_process');

const app = express();
app.use(cors());

/* =========================
   HELPER: HTTPS POST
========================= */
function httpsPost(hostname, path, postData, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          ...extraHeaders,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ body, statusCode: res.statusCode }));
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/* =========================
   STRATEGY 1: yt-dlp
========================= */
function tryYtDlp(ytUrl, audioOnly) {
  return new Promise((resolve) => {
    const format = audioOnly
      ? `-x --audio-format mp3 --get-url`
      : `-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --get-url`;

    exec(`yt-dlp ${format} "${ytUrl}" 2>&1`, { timeout: 25000 }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const line = stdout.trim().split('\n').find((l) => l.startsWith('http'));
      resolve(line || null);
    });
  });
}

/* =========================
   STRATEGY 2: cobalt.tools
========================= */
async function tryCobalt(ytUrl, audioOnly) {
  try {
    const postData = JSON.stringify({
      url: ytUrl,
      vQuality: 'max',
      isAudioOnly: audioOnly,
      aFormat: audioOnly ? 'mp3' : undefined,
      isNoTTWatermark: true,
    });

    const { body, statusCode } = await httpsPost('co.wuk.sh', '/api/json', postData);
    if (statusCode !== 200) return null;
    const json = JSON.parse(body);
    return json.url || null;
  } catch {
    return null;
  }
}

/* =========================
   STRATEGY 3: loader.to API
========================= */
async function tryLoaderTo(ytUrl, audioOnly) {
  try {
    const format = audioOnly ? 'mp3' : 'mp4';
    const quality = audioOnly ? '128' : '720';
    const apiUrl = `https://loader.to/api/button/?url=${encodeURIComponent(ytUrl)}&f=${format}&q=${quality}`;

    const result = await new Promise((resolve, reject) => {
      https.get(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve(body));
      }).on('error', reject);
    });

    const json = JSON.parse(result);
    // Poll for download link
    if (!json.id) return null;

    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollResult = await new Promise((resolve, reject) => {
        https.get(
          `https://loader.to/api/info/?id=${json.id}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } },
          (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => resolve(body));
          }
        ).on('error', reject);
      });

      const poll = JSON.parse(pollResult);
      if (poll.download_url) return poll.download_url;
      if (poll.success === true && poll.dl) return poll.dl;
    }
    return null;
  } catch {
    return null;
  }
}

/* =========================
   SHARED DOWNLOAD HANDLER
========================= */
async function handleDownload(req, res, audioOnly) {
  const url = req.query.url;
  if (!url) return res.status(400).send('No URL provided');

  console.log(`[${audioOnly ? 'MP3' : 'MP4'}] Fetching: ${url}`);

  let directUrl = null;

  // Strategy 1: yt-dlp (best, needs to be installed)
  directUrl = await tryYtDlp(url, audioOnly);
  if (directUrl) console.log('✅ yt-dlp success');

  // Strategy 2: cobalt.tools
  if (!directUrl) {
    directUrl = await tryCobalt(url, audioOnly);
    if (directUrl) console.log('✅ Cobalt success');
  }

  // Strategy 3: loader.to
  if (!directUrl) {
    directUrl = await tryLoaderTo(url, audioOnly);
    if (directUrl) console.log('✅ loader.to success');
  }

  if (!directUrl) {
    console.error('❌ All strategies failed');
    return res.status(500).json({
      error: 'Could not extract download URL',
      hint: 'Add yt-dlp to your Render build command: pip install yt-dlp',
    });
  }

  res.redirect(directUrl);
}

/* =========================
   ROUTES
========================= */
app.get('/download', (req, res) => handleDownload(req, res, false));
app.get('/download-mp3', (req, res) => handleDownload(req, res, true));
app.get('/', (req, res) => res.send('🔥 Backend is running'));

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
