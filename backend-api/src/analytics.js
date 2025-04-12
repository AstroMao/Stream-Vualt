// Video analytics endpoints will be moved here
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateToken, isAdmin } = require('./auth');

router.post('/api/analytics/view', authenticateToken, async (req, res) => {
  try {
    const { video_id, watch_time, playback_position, playback_rate } = req.body;
    const user_id = req.user.id;
    const view_date = new Date().toISOString().split('T')[0];
    const user_agent = req.headers['user-agent'];
    const device_type = /Mobile|Android|iOS/.test(user_agent) ? 'mobile' : 'desktop';
    
    // Check if video exists
    const videoResult = await pool.query('SELECT * FROM videos WHERE id = $1', [video_id]);
    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Check if view already exists for today
    const viewResult = await pool.query(
      'SELECT * FROM video_views WHERE video_id = $1 AND user_id = $2 AND view_date = $3',
      [video_id, user_id, view_date]
    );
    
    if (viewResult.rows.length > 0) {
      // Update existing view
      const result = await pool.query(
        'UPDATE video_views SET watch_time = watch_time + $1, max_playback_position = GREATEST(max_playback_position, $2), playback_rate = $3 WHERE id = $4 RETURNING *',
        [watch_time, playback_position, playback_rate, viewResult.rows[0].id]
      );
      
      // Update video views count
      await pool.query('UPDATE videos SET views = views + 1 WHERE id = $1', [video_id]);
      
      res.json(result.rows[0]);
    } else {
      // Create new view
      const result = await pool.query(
        'INSERT INTO video_views (video_id, user_id, view_date, watch_time, max_playback_position, playback_rate, device_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [video_id, user_id, view_date, watch_time, playback_position, playback_rate, device_type]
      );
      
      // Update video views count
      await pool.query('UPDATE videos SET views = views + 1 WHERE id = $1', [video_id]);
      
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Error recording view:', err);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

router.get('/api/analytics/views', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        v.title,
        COUNT(vv.id) as total_views,
        SUM(vv.watch_time) as total_watch_time,
        v.views as view_count
      FROM videos v
      LEFT JOIN video_views vv ON v.id = vv.video_id
      GROUP BY v.id
      ORDER BY total_views DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
