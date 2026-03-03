const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
app.use(cors());

/* =========================
   HELPER (SAFE EXEC)
========================= */
function runCommand(command, res) {
  exec(command, (err, stdout, stderr) => {
    if (err || !stdout) {
      console.error("ERROR:", err || stderr);
      return res.status(500).send("Download failed");
    }

    const cleanUrl = stdout.trim().split('\n')[0];

    if (!cleanUrl.startsWith("http")) {
      return res.status(500).send("Invalid download URL");
    }

    res.redirect(cleanUrl);
  });
}

/* =========================
   VIDEO DOWNLOAD (MP4)
========================= */
app.get('/download', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).send("No URL provided");
  }

  try {
    const api = `https://api.vevioz.com/api/button/mp4/${encodeURIComponent(url)}`;

    res.redirect(api);

  } catch (err) {
    console.error(err);
    res.status(500).send("Download failed");
  }
});
/* =========================
   AUDIO DOWNLOAD (MP3)
========================= */
app.get('/download-mp3', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).send("No URL provided");
  }

  try {
    const api = `https://api.vevioz.com/api/button/mp3/${encodeURIComponent(url)}`;

    res.redirect(api);

  } catch (err) {
    console.error(err);
    res.status(500).send("Download failed");
  }
});
/* =========================
   ROOT CHECK (IMPORTANT)
========================= */
app.get('/', (req, res) => {
  res.send("🔥 Backend is running");
});

/* =========================
   SERVER START (RENDER FIX)
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
