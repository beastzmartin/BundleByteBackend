# 🐳 BundleByte Backend - Docker Production Deployment Guide

This guide covers building, configuring, and running the **BundleByte Backend** using Docker, Docker Compose, or any container hosting platform (Render, Coolify, Portainer, CapRover, AWS ECS, DigitalOcean App Platform, VPS).

---

## 🚀 Quickstart with Docker Compose

The fastest way to spin up the backend alongside a dedicated MongoDB container:

### 1. Configure Environment
```bash
cp .env.docker.example .env
```
Open `.env` and configure:
- `JWT_SECRET`: A secure random secret string (min 32 characters).
- `CLIENT_URL`: The URL of your frontend (e.g., `https://bundlebytestore.com`).
- `MONGODB_URI`: Leave as `mongodb://mongo:27017/bundlebyte_db` for local containerized MongoDB, or set your remote MongoDB Atlas URI.

### 2. Start the Stack
```bash
docker compose up -d --build
```

### 3. Verify Health
Check container logs and health status:
```bash
docker compose ps
docker compose logs -f backend
```
Test the healthcheck endpoint:
```bash
curl http://localhost:5001/health
```
Expected output:
```json
{
  "status": "healthy",
  "timestamp": "2026-11-11T07:12:00.000Z",
  "environment": "production",
  "uptime": 12,
  "service": "BundleByte Marketplace API"
}
```

---

## 📦 Building & Running Standalone Container

If you are using an external managed database (such as **MongoDB Atlas**) and only want to run the backend container:

### 1. Build the Docker Image
```bash
docker build -t bundlebyte-backend .
```

### 2. Run the Container
```bash
docker run -d \
  --name bundlebyte-backend \
  --restart unless-stopped \
  -p 5001:5001 \
  -e NODE_ENV=production \
  -e PORT=5001 \
  -e CLIENT_URL="https://bundlebytestore.com" \
  -e MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/bundlebyte_db?retryWrites=true&w=majority" \
  -e JWT_SECRET="your_production_secret_key" \
  -v bundlebyte_uploads:/app/uploads \
  -v bundlebyte_backups:/app/backups \
  bundlebyte-backend
```

---

## ⚙️ Container Specifications & Security

- **Base Image:** `node:20-bookworm-slim` (LTS, small footprint ~180MB, glibc compatibility).
- **Non-Root Execution:** Container runs strictly as the unprivileged user `node` (`UID 1000`) for enhanced security and compliance.
- **Graceful Shutdown:** Handles `SIGTERM` and `SIGINT` signals to cleanly terminate active Socket.IO connections and close MongoDB connections within 10 seconds.
- **Built-in Healthcheck:** Integrated `HEALTHCHECK` running every 30 seconds against `/health` with automatic failure retries.
- **Persistent Data:**
  - `/app/uploads`: Stores product images, logos, banners, and digital delivery attachments.
  - `/app/backups`: Stores automated database snapshots and export archives.

---

## 🛠️ Common Operations

### View Real-Time Logs
```bash
docker compose logs -f backend
```

### Stop Services
```bash
docker compose down
```

### Restart Backend Service
```bash
docker compose restart backend
```

### Seed Initial Admin Data
If you need to seed initial roles, departments, or categories inside the running container:
```bash
docker compose exec backend npm run seed
```
