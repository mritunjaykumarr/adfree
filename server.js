const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
app.use(cors());

/* =========================
   HELPER: Fetch URL content
========================= */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data, headers: res.headers, statusCode: res.statusCode }));
    }).on('error', reject);
  });
}

/* =========================
   HELPER: Extract direct link
========================= */
function extractDirectLink(html, type) {
  // Try to find direct mp4/mp3 download links in the HTML response
  const patterns = [
    /href=["'](https?:\/\/[^"']*\.mp4[^"']*)/i,
    /href=["'](https?:\/\/[^"']*\.mp3[^"']*)/i,
    /src=["'](https?:\/\/[^"']*\.(mp4|mp3)[^"']*)/i,
    /"url"\s*:\s*["'](https?:\/\/[^"']+)/i,
    /window\.location\s*=\s*["'](https?:\/\/[^"']+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

/* =========================
   VIDEO DOWNLOAD (MP4)
========================= */
app.get('/download', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('No URL provided');

  try {
    // Strategy 1: Try yt-dlp if installed
    const { exec } = require('child_process');
    exec(`yt-dlp -f "best[ext=mp4]" --get-url "${url}" 2>/dev/null`, (err, stdout) => {
      if (!err && stdout && stdout.trim().startsWith('http')) {
        return res.redirect(stdout.trim().split('\n')[0]);
      }

      // Strategy 2: Try cobalt.tools API (free, no key needed)
      fetchUrl(`https://co.wuk.sh/api/json`)
        .then(() => {
          const postData = JSON.stringify({ url, vQuality: 'max', isNoTTWatermark: true });
          const options = {
            hostname: 'co.wuk.sh',
            path: '/api/json',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0',
            },
          };

          const request = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', chunk => body += chunk);
            apiRes.on('end', () => {
              try {
                const json = JSON.parse(body);
                if (json.url) return res.redirect(json.url);
                return res.status(500).send('Could not extract video URL');
              } catch {
                return res.status(500).send('API parse error');
              }
            });
          });
          request.on('error', () => res.status(500).send('Download failed'));
          request.write(postData);
          request.end();
        })
        .catch(() => res.status(500).send('Download failed'));
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Download failed');
  }
});

/* =========================
   AUDIO DOWNLOAD (MP3)
========================= */
app.get('/download-mp3', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('No URL provided');

  try {
    const { exec } = require('child_process');

    // Strategy 1: Try yt-dlp
    exec(`yt-dlp -x --audio-format mp3 --get-url "${url}" 2>/dev/null`, (err, stdout) => {
      if (!err && stdout && stdout.trim().startsWith('http')) {
        return res.redirect(stdout.trim().split('\n')[0]);
      }

      // Strategy 2: cobalt.tools with audio-only mode
      const postData = JSON.stringify({ url, isAudioOnly: true, aFormat: 'mp3' });
      const options = {
        hostname: 'co.wuk.sh',
        path: '/api/json',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      };

      const request = https.request(options, (apiRes) => {
        let body = '';
        apiRes.on('data', chunk => body += chunk);
        apiRes.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.url) return res.redirect(json.url);
            return res.status(500).send('Could not extract audio URL');
          } catch {
            return res.status(500).send('API parse error');
          }
        });
      });
      request.on('error', () => res.status(500).send('Download failed'));
      request.write(postData);
      request.end();
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Download failed');
  }
});

/* =========================
   ROOT CHECK
========================= */
app.get('/', (req, res) => {
  res.send('🔥 Backend is running');
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
