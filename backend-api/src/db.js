const { Pool } = require('pg');
const config = require('../index').config;

const pool = new Pool(config.db);

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
        is_hls BOOLEAN NOT NULL DEFAULT FALSE,
        language VARCHAR(50),
        subtitle_url VARCHAR(255),
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

module.exports = { pool, initializeDatabase };
