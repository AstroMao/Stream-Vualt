// Video analytics endpoints will be moved here
const pool = require('./db');
const { authenticateToken, isAdmin } = require('./auth');

async function analyticsRoutes(fastify, opts) {
  fastify.post('/api/analytics/view', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { video_id, watch_time, playback_position, playback_rate } = request.body;
      const user_id = request.user.id;
      const view_date = new Date().toISOString().split('T')[0];
      const user_agent = request.headers['user-agent'];
      const device_type = /Mobile|Android|iOS/.test(user_agent) ? 'mobile' : 'desktop';
      
      // Check if video exists
      const videoResult = await pool.query('SELECT * FROM videos WHERE id = $1', [video_id]);
      if (videoResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Video not found' });
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
        await pool.query('UPDATE videos SET view_count = view_count + 1 WHERE id = $1', [video_id]);
        
        return result.rows[0];
      } else {
        // Create new view
        const result = await pool.query(
          'INSERT INTO video_views (video_id, user_id, view_date, watch_time, max_playback_position, playback_rate, device_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
          [video_id, user_id, view_date, watch_time, playback_position, playback_rate, device_type]
        );
        
        // Update video views count
        await pool.query('UPDATE videos SET view_count = view_count + 1 WHERE id = $1', [video_id]);
        
        return result.rows[0];
      }
    } catch (err) {
      fastify.log.error('Error recording view:', err);
      return reply.code(500).send({ error: 'Failed to record view' });
    }
  });

  fastify.get('/api/analytics/views', { preHandler: [authenticateToken, isAdmin] }, async (request, reply) => {
    try {
      const result = await pool.query(`
        SELECT 
          v.title,
          COUNT(vv.id) as total_views,
          SUM(vv.watch_time) as total_watch_time,
          v.view_count as view_count
        FROM videos v
        LEFT JOIN video_views vv ON v.id = vv.video_id
        GROUP BY v.id
        ORDER BY total_views DESC
      `);
      
      return result.rows;
    } catch (err) {
      fastify.log.error('Error fetching analytics:', err);
      return reply.code(500).send({ error: 'Failed to fetch analytics' });
    }
  });
}

module.exports = analyticsRoutes;
