# Railway Deployment Guide

## Quick Deploy

### 1. Prerequisites

- GitHub account
- Railway account (https://railway.app)
- Railway CLI (optional, for local management)

### 2. One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new?template=https://github.com/kagan-u/LiveRadio)

Click the button above or follow the manual steps below.

### 3. Manual Setup

#### Step 1: Create Project

1. Go to https://railway.app/new
2. Select "Deploy from GitHub repo"
3. Select `kagan-u/LiveRadio`

#### Step 2: Add Services

Railway needs separate services. Add these:

**Option A: Single Service (Simplest)**

Use the `Dockerfile.railway` which bundles everything:

1. In Railway project settings, set the Dockerfile to `Dockerfile.railway`
2. Add environment variables (see below)
3. Deploy

**Option B: Multiple Services (Recommended for Production)**

1. **Database (PostgreSQL)**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway auto-provides `DATABASE_URL`

2. **Redis**
   - Click "New" → "Database" → "Redis"
   - Railway auto-provides `REDIS_URL`

3. **API Service**
   - Click "New" → "GitHub Repo" → select this repo
   - Set root directory to `services/api`
   - Set build command: `npm install -g pnpm && pnpm install && pnpm db:migrate`
   - Set start command: `pnpm db:seed && pnpm start`

4. **Web Service**
   - Click "New" → "GitHub Repo" → select this repo
   - Set root directory to `apps/web`
   - Set build command: `npm install -g pnpm && pnpm install && npm run build`
   - Set start command: `npm start`

5. **Streaming Server (Icecast)**
   - Click "New" → "Docker Image"
   - Use image: `castlabs/icecast:latest`
   - Set port to `8000`
   - Or use the custom Dockerfile: `infra/docker/Dockerfile.icecast`

#### Step 3: Environment Variables

Set these in Railway dashboard → Variables:

```
# Database (auto-set if using Railway PostgreSQL)
DATABASE_URL=<auto-provided>

# Redis (auto-set if using Railway Redis)
REDIS_URL=<auto-provided>

# API
API_PORT=4000
JWT_SECRET=<generate-a-random-string>
CORS_ORIGIN=https://your-app.up.railway.app

# Streaming
ICECAST_HOST=your-icecast-service.up.railway.app
ICECAST_PORT=80
ICECAST_SOURCE_PASSWORD=<your-source-password>
STREAM_MOUNT=/live

# Frontend
NEXT_PUBLIC_API_URL=https://your-api-service.up.railway.app
NEXT_PUBLIC_WS_URL=wss://your-api-service.up.railway.app
NEXT_PUBLIC_STREAM_URL=https://your-icecast-service.up.railway.app/live
```

#### Step 4: Generate Secrets

For `JWT_SECRET` and `ICECAST_SOURCE_PASSWORD`, generate random strings:

```bash
# On Linux/Mac
openssl rand -hex 32

# On Windows
powershell -Command "[System.Guid]::NewGuid().ToString('N')"
```

#### Step 5: Custom Domain (Optional)

1. Go to your web service → Settings → Networking
2. Click "Generate Domain" for a `.up.railway.app` domain
3. Or add your custom domain and configure DNS

### 4. Post-Deployment

After deployment:

1. Open your app URL
2. Register a new account
3. Go to Admin panel → change user role to `admin`
4. Or use the seed accounts:
   - `admin@radiolive.dev` / `admin123`
   - `dj@radiolive.dev` / `broadcaster123`
5. Go to DJ Panel → Start Broadcast
6. Open another browser → Listen page → Connect

### 5. Railway CLI (Optional)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Set variables
railway variables set JWT_SECRET="your-secret"
railway variables set CORS_ORIGIN="https://your-app.up.railway.app"

# Deploy
railway up

# View logs
railway logs

# Open dashboard
railway open
```

### 6. Database Migrations

On first deploy, the API service runs migrations automatically.

To run manually:

```bash
railway run npx tsx services/api/src/db/migrate.ts
railway run npx tsx services/api/src/db/seed.ts
```

### 7. Scaling

Railway allows vertical scaling. For a radio platform:

- **API**: 512MB RAM, 1 vCPU is enough for 100+ listeners
- **Database**: 256MB RAM for small to medium use
- **Icecast**: 256MB RAM handles many concurrent streams
- **Web**: 256MB RAM for Next.js

### 8. Monitoring

Railway provides built-in metrics:
- CPU usage
- Memory usage
- Network I/O
- Logs (real-time)

Access via Railway dashboard → your service → Metrics/Logs.

### 9. Costs

Railway free tier includes:
- $5/month credit
- 512MB RAM
- 1GB database
- 100GB bandwidth

This is enough for development and small-scale production.

### 10. Troubleshooting

**Build fails:**
- Check build logs in Railway dashboard
- Ensure all environment variables are set
- The pnpm workspace protocol is handled by `Dockerfile.railway`

**API can't connect to database:**
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running

**Audio stream not playing:**
- Verify Icecast service is running
- Check `NEXT_PUBLIC_STREAM_URL` points to the correct Icecast URL
- Ensure CORS is configured for the Icecast server

**WebSocket not connecting:**
- Use `wss://` protocol (not `ws://`) for production
- Set `NEXT_PUBLIC_WS_URL` to your API URL with `wss://`

### Architecture on Railway

```
User Browser
    ↓ HTTPS
Railway Load Balancer
    ↓
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  Web (3000) │    │ API (4000)   │    │ Icecast(8000)│
│  Next.js    │───▶│ Express+WS   │    │ Audio Stream │
└─────────────┘    └──────┬───────┘    └──────────────┘
                          │
                   ┌──────┴───────┐
                   │  PostgreSQL  │
                   │  Redis       │
                   └──────────────┘
```
