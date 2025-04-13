const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('./db');

const config = require('../index').config;
const storageDir = config.storage.path;

const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.mpg'];

const scanAndPopulateVideos = async () => {
  try {
    const directories = fs.readdirSync(storageDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const directory of directories) {
      const directoryPath = path.join(storageDir, directory);
      
      // Check if directory is already in database
      const result = await pool.query('SELECT * FROM videos WHERE title = $1', [directory]);
      if (result.rows.length > 0) {
        console.log(`Directory ${directory} already exists in database. Skipping...`);
        continue;
      }

      const files = fs.readdirSync(directoryPath);
      for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const fileExt = path.extname(file).toLowerCase();
        
        if (videoExtensions.includes(fileExt)) {
          const videoUUID = uuidv4();
          const relativePath = path.join(directory, file);
          
          await pool.query(
            `INSERT INTO videos (title, uuid, original_url)
             VALUES ($1, $2, $3)`,
            [directory, videoUUID, relativePath]
          );
          console.log(`Added ${directory} with UUID: ${videoUUID} and file: ${file}`);
          break; // Stop scanning further files in this directory
        }
      }
    }
  } catch (err) {
    console.error('Error scanning and populating videos:', err);
  }
};

module.exports = { scanAndPopulateVideos };
