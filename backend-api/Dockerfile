# Use official Node.js runtime as parent image
FROM node:18

# Set working directory in container
WORKDIR /app

# Copy package*.json files to container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code to container
COPY . .

# Expose port that the application will run on
EXPOSE 3001

# Command to run the application
CMD ["node", "index.js"]
