# Use official Node.js runtime as parent image with FFmpeg
FROM node:18

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Set working directory in container
WORKDIR /app

# Copy package*.json files to container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code to container
COPY . .

# Expose port that the application will run on
EXPOSE 3000

# Command to run the application
CMD ["node", "index.js"]
