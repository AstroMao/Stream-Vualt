# StreamVualt Project

## Overview
This project is a Video-on-Demand (VOD) streaming service platform designed to allow users to access video content through a web interface or embedded players on other websites. The platform will include features for video management, user authentication, and analytics. The project is inspired by and references the functionality of https://streamhg.com/.

## Scope
The project scope includes:
1. Backend API for video content management and user access control.
2. Frontend web application for video playback and user interface.
3. Integration with PostgreSQL database for storing video metadata and user information.
4. Implementation of user authentication and authorization.
5. Video analytics to track user engagement.

## Tech Stack
- Backend: Node.js with Express.js framework.
- Frontend: React.js.
- Database: PostgreSQL
- Video Streaming: HLS (HTTP Live Streaming) using nginx for serving video content.
- Containerization: Docker with docker-compose for easy deployment.

## Key Technical Features
1. **Video Streaming**: HLS (HTTP Live Streaming) implementation using nginx and Hls.js for seamless video playback.
2. **User Authentication**: JWT-based authentication with role-based access control for protected routes and admin-only sections.
3. **Containerization**: Docker with docker-compose for easy deployment of backend, frontend, and PostgreSQL services.
4. **Video Management**: RESTful API endpoints for video content management and metadata storage in PostgreSQL.
5. **Modern Frontend**: React.js application with a responsive UI, including features like login page, dashboard, charts, and user management.
6. **Flexible Storage**: Designed to support multiple storage backends (local, NFS, and future object storage integration).
7. **Video Analytics**: Enhanced analytics capabilities including watch time tracking, user region tracking, and video heatmap analysis through additional database tables and API endpoints.

## Storage Options
The project currently uses local storage, but is being enhanced to support multiple storage backends, including:
- Local file system
- NFS (Network File System)
- Future support for object storage (e.g., MinIO, AWS S3)

## Authentication Details
- The system uses JWT tokens for secure authentication.
- Tokens are stored in localStorage for persistence.
- Protected routes require authentication.
- Admin-only sections include Analytics, Settings, and User Management.
- Default admin credentials:
  - Email: admin@example.com
  - Password: admin123

## Containerization Details
- Dockerfiles are available for both backend and frontend services.
- docker-compose.yml orchestrates the backend, frontend, and PostgreSQL database services.
- An .env.example file is provided to configure environment variables for Docker setup.
- Users can customize various settings using environment variables.

## Video Playback
- The backend API serves HLS content for video playback at `http://localhost:3000/hls/{video_id}/master.m3u8`.
- The frontend application now uses Hls.js to play HLS streams, providing a seamless video playback experience.

## Future Work
1. Test the video playback functionality thoroughly.
2. Enhance video analytics tracking.
3. Explore additional features or optimizations as needed.

## Important Details
- Backend API runs on port 3001.
- Video content is served using nginx HLS streaming, as configured in nginx-local.conf.
- The 'player/' folder contains the current video player implementation.
- Reference site: https://streamhg.com/
