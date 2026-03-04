# Development stage — includes devDependencies for hot-reloading with nodemon
FROM node:24-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ ./src/
CMD ["npx", "nodemon", "src/app.js"]

# Production stage — lean image with only runtime dependencies
FROM node:24-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/app.js"]
