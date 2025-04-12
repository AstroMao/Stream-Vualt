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

router.post('/api/videos', authenticateToken, isAdmin, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, description, thumbnail, duration, category } = req.body;
    const uuid = uuidv4();
    const originalFilePath = req.file.path;

    const result = await pool.query(
      'INSERT INTO videos (title, description, thumbnail, duration, category, user_id, uuid, original_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [title, description, thumbnail, duration, category, req.user.id, uuid, originalFilePath]
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

router.post('/api/videos/upload', authenticateToken, isAdmin, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const originalFilePath = req.file.path;
    const filename = req.file.originalname;
    const baseFilename = path.parse(filename).name;
    
    // For manual HLS content upload, we expect a zip file containing the HLS segments and playlist
    if (req.file.mimetype === 'application/zip') {
      // Extract the zip file
      const extractPath = path.join(path.dirname(originalFilePath), baseFilename);
      await fs.promises.mkdir(extractPath, { recursive: true });
      
      // Note: extractZip is not defined in the original code
      // You would need to implement this or use a library like 'extract-zip'
      // For now, let's leave a note about this missing functionality
      
      // TODO: Implement zip extraction functionality
      
      res.json({ message: 'HLS content upload feature requires additional implementation' });
    } else {
      // Non-zip file handling would go here
      res.json({ message: 'File uploaded but processing is not implemented' });
    }
  } catch (err) {
    console.error('Error uploading or processing video:', err);
    res.status(500).json({ error: 'Failed to upload or process video' });
  }
});

const bunnyCdnDomain = process.env.BUNNYCDN_DOMAIN || 'your-bunnycdn-domain.bcdn.net';

router.get('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const video = result.rows[0];
    const localUrl = `http://localhost:3000/hls/${video.uuid}/master.m3u8`;
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
