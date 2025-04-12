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

module.exports.config = config;

const app = express();
app.use(express.json());
app.use(cors({
  origin: config.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use('/hls', express.static(config.storage.path));

app.get('/player/:uuid', (req, res) => {
  res.sendFile(path.join(__dirname, 'player.html'), {
    headers: {
      'Content-Type': 'text/html'
    }
  });
});

const pool = require('./src/db');

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
        original_url VARCHAR(255) NOT NULL,
        transcoded BOOLEAN NOT NULL DEFAULT FALSE,
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


// Simple test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

const videoRouter = require('./src/video');
app.use(videoRouter);

const analyticsRouter = require('./src/analytics');
app.use(analyticsRouter);

require('./src/transcode');

app.listen(config.server.port, () => {
  console.log(`Server running on port ${config.server.port}`);
});
