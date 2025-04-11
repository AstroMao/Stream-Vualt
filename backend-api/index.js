const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const Storage = require('./storage');
const { spawn } = require('child_process');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const storage = new Storage(process.env.STORAGE_TYPE || 'local');
const upload = multer({ dest: 'uploads/' });


const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use('/hls', express.static('storage'));

const pool = new Pool({
  user: process.env.DB_USER || 'video_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'video_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// Create a mock admin user for testing
const mockAdminUser = {
  id: 1,
  name: 'Admin User',
  email: 'admin@example.com',
  password: bcrypt.hashSync('admin123', 10),
  role: 'admin',
  active: true,
  created_at: new Date().toISOString()
};

// Users table in the database
const getUsersFromDatabase = async () => {
  const result = await pool.query('SELECT id, name, email, role, active, created_at FROM users');
  return result.rows;
};

// Mock videos array
// Mock video views array
const videoViews = [];

// JWT Secret
const JWT_SECRET = 'your_jwt_secret_key'; // In production, use environment variable

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }
  next();
};

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
// Find user in the database
const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user is active
    if (!user.active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User management routes (admin only)
app.get('/api/users', authenticateToken, isAdmin, (req, res) => {
  res.json(users);
});

app.post('/api/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, email, password, role, active } = req.body;
    
    // Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, active) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, active, created_at',
      [name, email, hashedPassword, role, active !== undefined ? active : true]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, active } = req.body;
    
    // Validate input
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required' });
    }
    
    // Update user
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, role = $3, active = $4 WHERE id = $5 RETURNING id, name, email, role, active, created_at',
      [name, email, role, active, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Simple test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

// Video management endpoints
const { v4: uuidv4 } = require('uuid');

app.post('/api/videos', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, description, url, thumbnail, duration, category } = req.body;
    const uuid = uuidv4();
    const result = await pool.query(
      'INSERT INTO videos (title, description, original_url, thumbnail, duration, category, user_id, uuid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [title, description, url, thumbnail, duration, category, req.user.id, uuid]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating video:', err);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

app.get('/api/videos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM videos');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching videos:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

app.post('/api/videos/upload', authenticateToken, isAdmin, upload.single('video'), async (req, res) => {
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
      await promisify(fs.mkdir)(extractPath);
      await extractZip(originalFilePath, { dir: extractPath });
      
      // Save the extracted HLS content to storage
      const hlsContent = {};
      const hlsDir = path.join(extractPath, baseFilename);
      const files = await promisify(fs.readdir)(hlsDir);
      for (const file of files) {
        const filePath = path.join(hlsDir, file);
        const fileBuffer = await promisify(fs.readFile)(filePath);
        hlsContent[file] = fileBuffer.toString();
      }
      await storage.saveDirectory(baseFilename, hlsContent);
      
      // Clean up
      await promisify(fs.rm)(extractPath, { recursive: true, force: true });
      
      res.json({ message: 'HLS content uploaded successfully' });
    } else {
    }
  } catch (err) {
    console.error('Error uploading or processing video:', err);
    res.status(500).json({ error: 'Failed to upload or process video' });
  }
});

app.get('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching video:', err);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

app.put('/api/videos/:id', authenticateToken, isAdmin, async (req, res) => {
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

app.delete('/api/videos/:id', authenticateToken, isAdmin, async (req, res) => {
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

// Video analytics endpoints
app.post('/api/analytics/view', authenticateToken, async (req, res) => {
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
        'UPDATE video_views SET views = views + 1, watch_time = watch_time + $1, max_playback_position = GREATEST(max_playback_position, $2), playback_rate = $3 WHERE id = $4 RETURNING *',
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

app.get('/api/analytics/views', authenticateToken, isAdmin, async (req, res) => {
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

const PORT = process.env.BACKEND_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
