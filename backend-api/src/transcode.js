const pool = require('./db');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../index').config;

const transcodeVideoToHLS = async (videoId, originalFilePath, uuid) => {
  try {
    // Create a directory for the HLS content using the UUID
    const hlsDirectory = path.join(config.storage.path, uuid);
    await fs.promises.mkdir(hlsDirectory, { recursive: true });

    // Transcode the video to HLS using ffmpeg
    const ffmpegCommand = `mkdir -p ${hlsDirectory}/1080p ${hlsDirectory}/720p ${hlsDirectory}/480p && ffmpeg -i ${originalFilePath} \
      -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:a:0 \
      -c:v h264_nvenc \
      -filter:v:0 "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
      -filter:v:1 "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" \
      -filter:v:2 "scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2" \
      -b:v:0 5000k -b:v:1 3000k -b:v:2 1000k \
      -c:a:0 aac -b:a:0 128k -ac:0 2 \
      -c:a:1 aac -b:a:1 128k -ac:1 2 \
      -c:a:2 aac -b:a:2 128k -ac:2 2 \
      -f hls \
      -hls_time 6 \
      -hls_list_size 0 \
      -hls_segment_filename "${hlsDirectory}/%v/segment%d.ts" \
      -master_pl_name master.m3u8 \
      -var_stream_map "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p" \
      ${hlsDirectory}/%v/playlist.m3u8`;

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

    // Update the video record to mark it as transcoded
    await pool.query('UPDATE videos SET transcoded = TRUE WHERE id = $1', [videoId]);
  } catch (err) {
    console.error('Error transcoding video:', err);
  }
};

// This function will be used to transcode videos in the background
const processVideoTranscoding = async () => {
  try {
    const result = await pool.query('SELECT * FROM videos WHERE transcoded = FALSE');
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
