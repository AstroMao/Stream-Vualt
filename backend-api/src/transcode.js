const { pool } = require('./db');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../index').config;

const transcodeVideoToHLS = async (videoId, originalFilePath, uuid) => {
  try {
    const hlsDirectory = path.join(config.storage.path, uuid);
    await fs.promises.mkdir(hlsDirectory, { recursive: true });

    // Create directories for each resolution
    const resolutions = [
      { name: '480p', scale: '854:480', bitrate: '1000k' },
      { name: '720p', scale: '1280:720', bitrate: '3000k' },
      { name: '1080p', scale: '1920:1080', bitrate: '5000k' }
    ];

    for (const resolution of resolutions) {
      const resolutionDir = path.join(hlsDirectory, resolution.name);
      await fs.promises.mkdir(resolutionDir, { recursive: true });

      const ffmpegCommand = `ffmpeg -i ${originalFilePath} \
        -map 0:v:0 -map 0:a:0 \
        -c:v h264_nvenc \
        -filter:v "scale=${resolution.scale}:force_original_aspect_ratio=decrease,pad=${resolution.scale}:(ow-iw)/2:(oh-ih)/2" \
        -b:v ${resolution.bitrate} \
        -c:a aac -b:a 128k -ac 2 \
        -f hls \
        -hls_time 6 \
        -hls_list_size 0 \
        -hls_segment_filename "${resolutionDir}/segment%d.ts" \
        ${resolutionDir}/playlist.m3u8`;

      await new Promise((resolve, reject) => {
        const childProcess = spawn(ffmpegCommand, { shell: true });
        childProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg command failed with code ${code}`));
          }
        });
      });

      // After transcoding the first resolution (480p), we can make it available to the player
      if (resolution.name === '480p') {
        // Create a master playlist with the available resolutions so far
        const masterPlaylistContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=${resolution.bitrate},RESOLUTION=${resolution.scale}
${resolution.name}/playlist.m3u8`;
        await fs.promises.writeFile(path.join(hlsDirectory, 'master.m3u8'), masterPlaylistContent);
      }
    }

    // Update the video record to mark it as HLS
    await pool.query('UPDATE videos SET is_hls = TRUE WHERE id = $1', [videoId]);
  } catch (err) {
    console.error('Error transcoding video:', err);
  }
};

// This function will be used to transcode videos in the background
const processVideoTranscoding = async () => {
  try {
    const result = await pool.query('SELECT * FROM videos WHERE is_hls = FALSE');
    for (const video of result.rows) {
      await transcodeVideoToHLS(video.id, video.original_url, video.uuid);
    }
  } catch (err) {
    console.error('Error processing video transcoding:', err);
  }
};

// Run the transcoding process at regular intervals
setInterval(processVideoTranscoding, 60000); // Run every 1 minute

module.exports = { transcodeVideoToHLS };
