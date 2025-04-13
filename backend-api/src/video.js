// Video management endpoints will be moved here
const fastifyMulter = require('fastify-multer');
const pool = require('./db');
const { authenticateToken, isAdmin } = require('./auth');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../index').config;

const upload = fastifyMulter({ dest: 'uploads/' });

async function videoRoutes(fastify, opts) {
  fastify.post('/api/videos', { preHandler: [authenticateToken, isAdmin, upload.fields([{ name: 'video' }, { name: 'subtitle' }])] }, async (request, reply) => {
    try {
      if (!request.files || !request.files['video']) {
        return reply.code(400).send({ error: 'No video file provided' });
      }

      const { title, description, thumbnail, duration, category, language } = request.body;
      const uuid = uuidv4();
      const originalFilePath = request.files['video'][0].path;
      const subtitleUrl = request.files['subtitle'] ? request.files['subtitle'][0].path : null;

      const result = await pool.query(
        'INSERT INTO videos (title, description, thumbnail, duration, category, user_id, uuid, original_url, language, subtitle_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [title, description, thumbnail, duration, category, request.user.id, uuid, originalFilePath, language, subtitleUrl]
      );
      return result.rows[0];
    } catch (err) {
      fastify.log.error('Error creating video:', err);
      return reply.code(500).send({ error: 'Failed to create video' });
    }
  });

  fastify.get('/api/videos', async () => {
    try {
      const result = await pool.query('SELECT * FROM videos');
      return result.rows;
    } catch (err) {
      fastify.log.error('Error fetching videos:', err);
      throw { statusCode: 500, error: 'Failed to fetch videos' };
    }
  });

  fastify.post('/api/videos/upload', { preHandler: [authenticateToken, isAdmin, upload.fields([{ name: 'video' }, { name: 'subtitle' }])] }, async (request, reply) => {
    try {
      if (!request.files || !request.files['video']) {
        return reply.code(400).send({ error: 'No video file provided' });
      }

      const videoFile = request.files['video'][0];
      const originalFilePath = videoFile.path;
      const videoId = request.body.videoId;

      if (!videoId) {
        return reply.code(400).send({ error: 'Video ID is required' });
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

      return { message: 'Video upload successful. Transcoding is in progress.', video: result.rows[0] };
    } catch (err) {
      fastify.log.error('Error uploading or processing video:', err);
      return reply.code(500).send({ error: 'Failed to upload or process video' });
    }
  });

  fastify.get('/api/videos/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const result = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Video not found' });
      }
      
      const video = result.rows[0];
      const localUrl = `http://localhost:3001/hls/${video.id}/${video.uuid}/master.m3u8`;
      const bunnyCdnDomain = process.env.BUNNYCDN_DOMAIN || 'your-bunnycdn-domain.bcdn.net';
      const cdnUrl = `https://${bunnyCdnDomain}/hls/${video.uuid}/master.m3u8`;
      
      return {
        ...video,
        localUrl,
        cdnUrl
      };
    } catch (err) {
      fastify.log.error('Error fetching video:', err);
      return reply.code(500).send({ error: 'Failed to fetch video' });
    }
  });

  fastify.put('/api/videos/:id', { preHandler: authenticateToken, isAdmin }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { title, description, url, thumbnail, duration, category } = request.body;
      
      const result = await pool.query(
        'UPDATE videos SET title = $1, description = $2, original_url = $3, thumbnail = $4, duration = $5, category = $6 WHERE id = $7 RETURNING *',
        [title, description, url, thumbnail, duration, category, id]
      );
      
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Video not found' });
      }
      
      return result.rows[0];
    } catch (err) {
      fastify.log.error('Error updating video:', err);
      return reply.code(500).send({ error: 'Failed to update video' });
    }
  });

  fastify.delete('/api/videos/:id', { preHandler: [authenticateToken, isAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params;
      
      // Check if video exists
      const videoResult = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);
      if (videoResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Video not found' });
      }
      
      // Delete video
      await pool.query('DELETE FROM videos WHERE id = $1', [id]);
      
      return { message: 'Video deleted successfully' };
    } catch (err) {
      fastify.log.error('Error deleting video:', err);
      return reply.code(500).send({ error: 'Failed to delete video' });
    }
  });
}

module.exports = videoRoutes;
