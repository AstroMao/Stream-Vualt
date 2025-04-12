# StreamVualt Project

## Overview
This project is a Video-on-Demand (VOD) streaming service platform that allows users to access video content through a web interface or embedded players on other websites. It includes features for video management, user authentication, and analytics.

## Tech Stack
- Backend: Node.js with Express.js
- Frontend: React.js
- Database: PostgreSQL
- Video Streaming: HLS (HTTP Live Streaming) using nginx
- Containerization: Docker with docker-compose

## Key Features
1. **Video Streaming**: HLS implementation using nginx and Hls.js
2. **User Authentication**: JWT-based authentication with role-based access control
3. **Video Management**: RESTful API endpoints for video content management
4. **Video Analytics**: Simplified analytics capabilities

## Storage and CDN
The project uses BunnyCDN for caching and bandwidth offloading, ensuring faster video delivery and reduced server load.

## Containerization
- Dockerfiles for backend and frontend services
- docker-compose.yml for orchestrating services

## Important Details
- Backend API runs on port 3001
- Video content is served using nginx HLS streaming
- The 'player/' folder contains the video player implementation

For more information on the backend API, see [backend-api/README.md](backend-api/README.md).
