// Video management endpoints will be moved here
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateToken, isAdmin } = require('./auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../index').config;

router.post('/api/videos', authenticateToken, isAdmin, upload.fields([{ name: 'video' }, { name: 'subtitle' }]), async (req, res) => {
  try {
    if (!req.files || !req.files['video']) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, description, thumbnail, duration, category, language } = req.body;
    const uuid = uuidv4();
    const originalFilePath = req.files['video'][0].path;
    const subtitleUrl = req.files['subtitle'] ? req.files['subtitle'][0].path : null;

    const result = await pool.query(
      'INSERT INTO videos (title, description, thumbnail, duration, category, user_id, uuid, original_url, language, subtitle_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [title, description, thumbnail, duration, category, req.user.id, uuid, originalFilePath, language, subtitleUrl]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating video:', err);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

router.get('/api/videos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM videos');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching videos:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

router.post('/api/videos/upload', authenticateToken, isAdmin, upload.fields([{ name: 'video' }, { name: 'subtitle' }]), async (req, res) => {
  try {
    if (!req.files || !req.files['video']) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const videoFile = req.files['video'][0];
    const originalFilePath = videoFile.path;
    const videoId = req.body.videoId; // Assuming videoId is provided in the request body

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const storagePath = config.storage.path;
    const videoDir = path.join(storagePath, videoId.toString());
    const finalFilePath = path.join(videoDir, videoFile.originalname);

    // Create the video directory and move the uploaded file
    await fs.promises.mkdir(videoDir, { recursive: true });
    await fs.promises.rename(originalFilePath, finalFilePath);

    // Create a database record for the uploaded video
    const uuid = uuidv4();
    const result = await pool.query(
      'INSERT INTO videos (title, file_path, uuid, player_url, video_length, file_size, language, subtitle, resolution, is_transcode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [videoFile.originalname, finalFilePath, uuid, `http://localhost:3001/player/${uuid}`, '00:00:00', videoFile.size, 'en', null, '480p', false]
    );

    res.json({ message: 'Video upload successful. Transcoding is in progress.', video: result.rows[0] });
  } catch (err) {
    console.error('Error uploading or processing video:', err);
    res.status(500).json({ error: 'Failed to upload or process video' });
  }
});

// New function to check if a file is HLS
const checkIfHLS = async (filePath) => {
  // Logic to check if the file is HLS (e.g., check file extension, inspect file contents)
  // For now, let's assume we check the file extension
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.m3u8' || ext === '.zip'; // Consider .m3u8 and .zip as HLS
};

const bunnyCdnDomain = process.env.BUNNYCDN_DOMAIN || 'your-bunnycdn-domain.bcdn.net';

router.get('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const video = result.rows[0];
    const localUrl = `http://localhost:3001/hls/${video.id}/${video.uuid}/master.m3u8`;
    const cdnUrl = `https://${bunnyCdnDomain}/hls/${video.uuid}/master.m3u8`;
    
    res.json({
      ...video,
      localUrl,
      cdnUrl
    });
  } catch (err) {
    console.error('Error fetching video:', err);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

router.put('/api/videos/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, url, thumbnail, duration, category } = req.body;
    
    const result = await pool.query(
      'UPDATE videos SET title = $1, description = $2, original_url = $3, thumbnail = $4, duration = $5, category = $6 WHERE id = $7 RETURNING *',
      [title, description, url, thumbnail, duration, category, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating video:', err);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

router.delete('/api/videos/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if video exists
    const videoResult = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);
    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Delete video
    await pool.query('DELETE FROM videos WHERE id = $1', [id]);
    
    res.json({ message: 'Video deleted successfully' });
  } catch (err) {
    console.error('Error deleting video:', err);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

module.exports = router;
