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
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Core configuration from environment variables
const config = {
  db: {
    user: process.env.DB_USER || 'video_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'video_db',
    password: process.env.DB_PASSWORD || 'db_password',
    port: parseInt(process.env.DB_PORT || '5432'),
  },
  server: {
    port: parseInt(process.env.BACKEND_PORT || '3001'),
  },
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    path: process.env.STORAGE_PATH || './storage',
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your_secure_jwt_secret_key',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  }
};

const storage = new Storage(config.storage.type);
const upload = multer({ dest: 'uploads/' });

const app = express();
app.use(express.json());
app.use(cors({
  origin: config.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use('/hls', express.static(config.storage.path));

const pool = new Pool(config.db);

// Initialize database
const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        original_url VARCHAR(255) NOT NULL,
        thumbnail VARCHAR(255),
        duration INTEGER,
        category VARCHAR(100),
        user_id INTEGER REFERENCES users(id),
        uuid VARCHAR(255) NOT NULL,
        views INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_views (
        id SERIAL PRIMARY KEY,
        video_id INTEGER REFERENCES videos(id),
        user_id INTEGER REFERENCES users(id),
        view_date DATE NOT NULL,
        watch_time INTEGER NOT NULL DEFAULT 0,
        max_playback_position INTEGER NOT NULL DEFAULT 0,
        playback_rate FLOAT NOT NULL DEFAULT 1.0,
        device_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (video_id, user_id, view_date)
      );
    `);

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
};

// Test database connection and initialize
pool.query('SELECT NOW()', async (err, res) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  } else {
    console.log('Database connected successfully');
    await initializeDatabase();
    await createMockAdminUser();
  }
});

// Create a mock admin user for testing
const createMockAdminUser = async () => {
  try {
    const mockAdminUser = {
      name: 'Admin User',
      email: 'admin@example.com',
      password: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      active: true
    };

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [mockAdminUser.email]);
    if (result.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (name, email, password, role, active) VALUES ($1, $2, $3, $4, $5)',
        [mockAdminUser.name, mockAdminUser.email, mockAdminUser.password, mockAdminUser.role, mockAdminUser.active]
      );
      console.log('Mock admin user created');
    } else {
      console.log('Mock admin user already exists');
    }
  } catch (err) {
    console.error('Error creating mock admin user:', err);
  }
};

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, config.security.jwtSecret, (err, user) => {
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
      config.security.jwtSecret,
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
app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, active, created_at FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
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

app.listen(config.server.port, () => {
  console.log(`Server running on port ${config.server.port}`);
});
