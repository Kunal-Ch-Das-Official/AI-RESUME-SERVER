# Base runtime
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Copy dependency manifests first for Docker layer caching
COPY package.json package-lock.json ./

# Install dependencies required for building
RUN npm ci

# Copy application source
COPY . .

# Build the Subatom application
RUN npm run build

# Remove development-only dependencies after building
RUN npm prune --omit=dev

# Run as the non-root Node.js user
USER node

# Application port inside the container
EXPOSE 8080

# Start the production server
CMD ["npm", "start"]