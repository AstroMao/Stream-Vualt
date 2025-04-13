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
app.use('/static', express.static(path.join(__dirname, 'src')));

app.get('/player/:uuid', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/player.html'), {
    headers: {
      'Content-Type': 'text/html'
    }
  });
});

const { pool, initializeDatabase } = require('./src/db');

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
