const fastify = require('fastify')({ logger: true });
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fastifyStatic = require('@fastify/static');
const multer = require('fastify-multer');
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

const storage = require('./storage')(config.storage.type);
const upload = multer({ dest: 'uploads/' });

fastify.register(fastifyStatic, {
  root: config.storage.path,
  prefix: '/hls/',
});

fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'src'),
  prefix: '/static/',
});

fastify.get('/player/:uuid', async (request, reply) => {
  return reply.sendFile('player.html', path.join(__dirname, 'src'));
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
fastify.get('/api/test', async () => {
  return { message: 'API is working' };
});

fastify.register(require('./src/video'));
fastify.register(require('./src/analytics'));

require('./src/transcode');

const start = async () => {
  try {
    await fastify.listen({ port: config.server.port });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
