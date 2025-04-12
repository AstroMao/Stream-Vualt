# Backend API Documentation

## Overview
This is the backend API for the Video-on-Demand (VOD) streaming service. It provides RESTful API endpoints for video management, user authentication, and video analytics. The API is built using Node.js and Express.js, and it uses a PostgreSQL database to store video metadata and user information.

## API Endpoints

### Authentication
* **POST /api/auth/login**: Authenticate a user and return a JWT token.
	+ Request Body: `{ email, password }`
	+ Response: `{ token, user }`

### Video Management
* **POST /api/videos**: Create a new video.
	+ Request Body: `{ title, description, thumbnail, duration, category }`
	+ Request Headers: `Authorization: Bearer <JWT token>`
	+ Response: `{ id, title, description, ... }`
* **GET /api/videos**: Retrieve a list of all videos.
	+ Response: `[ { id, title, description, ... }, ... ]`
* **GET /api/videos/:id**: Retrieve a specific video by ID.
	+ Response: `{ id, title, description, ... }`
* **PUT /api/videos/:id**: Update a video.
	+ Request Body: `{ title, description, url, thumbnail, duration, category }`
	+ Request Headers: `Authorization: Bearer <JWT token>`
	+ Response: `{ id, title, description, ... }`
* **DELETE /api/videos/:id**: Delete a video.
	+ Request Headers: `Authorization: Bearer <JWT token>`
	+ Response: `{ message: 'Video deleted successfully' }`

### Video Analytics
* **POST /api/analytics/view**: Record a video view.
	+ Request Body: `{ video_id, watch_time, playback_position, playback_rate }`
	+ Request Headers: `Authorization: Bearer <JWT token>`
	+ Response: `{ id, video_id, user_id, ... }`
* **GET /api/analytics/views**: Retrieve video analytics.
	+ Request Headers: `Authorization: Bearer <JWT token>`
	+ Response: `[ { title, total_views, total_watch_time, ... }, ... ]`

## Notes
* All endpoints that require authentication expect a valid JWT token in the `Authorization` header.
* The video transcoding is handled by a background process using FFmpeg.
* The API uses a PostgreSQL database to store video metadata and user information.
