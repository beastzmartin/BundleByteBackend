# =========================================================================
# BundleByte Enterprise Backend - Production Dockerfile
# Optimized for security, minimal image size, layer caching, and health
# =========================================================================

FROM node:20-bookworm-slim

# Install system dependencies (curl for container healthcheck, ca-certificates for secure HTTPS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Prepare upload and backup directories with appropriate permissions for non-root user
RUN mkdir -p /app/uploads /app/backups && chown -R node:node /app

# Set default production environment variables
ENV NODE_ENV=production \
    PORT=5001

# Copy package definitions first to maximize Docker layer caching
COPY --chown=node:node package*.json ./

# Install production dependencies only (ignores devDependencies like nodemon)
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy all application source code with non-root ownership
COPY --chown=node:node . .

# Enforce non-root execution for container security
USER node

# Expose API and WebSocket port (defaults to 5001, configurable via PORT env var)
EXPOSE 5001

# Health check to verify API liveness and container readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5001}/health || exit 1

# Start production server
CMD ["node", "src/server.js"]

