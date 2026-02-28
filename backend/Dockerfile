# Backend Lambda Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build:all

# Expose ports for local development
EXPOSE 3000 3001

# Default command (can be overridden)
CMD ["node", "dist/websocket.js"]
