# VideoJS-player Project

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
- Database: PostgreSQL hosted on a Proxmox server.
- Video Streaming: HLS (HTTP Live Streaming) using nginx for serving video content.
- Containerization: Docker with docker-compose for easy deployment.

## Current Status
- Backend API: Implemented using Node.js and Express.js. Successfully connected to a PostgreSQL database hosted on a Proxmox server. Video management endpoints have been implemented. User authentication and authorization have been added using JWT tokens.
- Frontend: React.js application with a modern UI, including a login page, dashboard with charts and statistics, and other required views (Library, Analytics, Settings, Users). Navigation sidebar with protected routes based on user roles.
- Video Player: Using Hls.js for HLS content playback in the React.js application.
- Nginx Configuration: nginx-local.conf provides the current nginx configuration for HLS streaming.
- Containerization: Dockerfiles have been created for both backend and frontend. A docker-compose.yml file orchestrates the services, including a PostgreSQL database.

## Completed Tasks
1. Set up a new backend API project in 'backend-api/'.
6. Implemented video management endpoints in the backend API.
7. Implemented a new React.js frontend application with a modern UI.
8. Created a dashboard with charts and statistics.
9. Implemented navigation sidebar with routes for Dashboard, Library, Analytics, Settings, and Users.
10. Added Chart.js integration for data visualization.
11. Implemented user authentication and authorization using JWT tokens.
12. Added role-based access control (admin vs regular users).
13. Created login page and authentication state management.
14. Implemented route guards to protect authenticated routes.
15. Prepared the project for containerization using Docker and docker-compose.
16. Integrated Hls.js for HLS content playback in the React.js application.

## Next Steps
1. Implement a flexible storage system (initially focusing on local/NFS storage).
2. Enhance the video management functionality, including video transcoding.
3. Develop video analytics tracking.
4. Implement user registration functionality.
5. Add password reset capabilities.
6. Explore object storage integration (e.g., MinIO) for future scalability.

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
- PostgreSQL database details: host=10.10.10.10, database=video_db, user=video_user, password=Astr0mao@db, port=5432 (for non-containerized setup).
- Video content is served using nginx HLS streaming, as configured in nginx-local.conf.
- The 'player/' folder contains the current video player implementation.
- Reference site: https://streamhg.com/
