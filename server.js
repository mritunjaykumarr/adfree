const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
app.use(cors());

/* =========================
   VIDEO DOWNLOAD (MP4)
========================= */
app.get('/download', (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).send("No URL provided");
  }

  const command = `yt-dlp -f best -g "${url}"`;

  exec(command, (err, stdout) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Download failed");
    }

    const videoUrl = stdout.trim();

    res.redirect(videoUrl);
  });
});
/* =========================
   AUDIO DOWNLOAD (MP3)
========================= */
app.get('/download-mp3', (req, res) => {
  const url = req.query.url;

  const command = `yt-dlp -f bestaudio -g "${url}"`;

  exec(command, (err, stdout) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Download failed");
    }

    const audioUrl = stdout.trim();

    res.redirect(audioUrl);
  });
});
app.listen(3000, () => {
  console.log("🔥 Server running on http://localhost:3000");
});