# RadioLive

Open-source internet radio platform. One live stream. Everyone hears the same thing.

## Quick Start

### Docker (Recommended)

```bash
cp .env.example .env
docker compose up -d
```

Visit `http://localhost:3000`

### Local Development

**Prerequisites:** Node.js 20+, PostgreSQL, Redis, Icecast2

```bash
# Install dependencies
pnpm install

# Setup database
cd services/api
cp ../../.env ../../.env.local
pnpm db:migrate
pnpm db:seed

# Start servers (in separate terminals)
pnpm dev:api
pnpm dev:web
```

**Default accounts:**
- `admin@radiolive.dev` / `admin123` (admin)
- `dj@radiolive.dev` / `broadcaster123` (broadcaster)

## Architecture

```
Broadcaster App (Electron/FFmpeg)
    → Audio Capture (system audio)
    → Encoding (MP3/AAC)
    → Icecast Server (streaming)
        → Web Player (Next.js)
        → Listeners (browser audio)
```

### How It Works

1. **Broadcaster** captures system audio (Spotify, YouTube, etc.)
2. Audio is encoded and sent to Icecast server
3. **Web Player** connects to Icecast audio stream
4. **WebSockets** deliver metadata, chat, and listener counts
5. All listeners hear the same live stream

## Streaming

### System Audio Capture (Recommended)

Use the Electron broadcaster app or FFmpeg to capture system audio:

**macOS (BlackHole):**
```bash
# Install BlackHole for system audio capture
brew install blackhole-2ch

# Capture system audio and stream to Icecast
ffmpeg -f coreaudio -i ":BlackHole 2ch" \
  -f mp3 -b:a 192k \
  icecast://source:STREAM_KEY@localhost:8000/live
```

**Linux (PulseAudio):**
```bash
# Capture system audio
ffmpeg -f pulse -i default \
  -f mp3 -b:a 192k \
  icecast://source:STREAM_KEY@localhost:8000/live
```

**Windows (Stereo Mix):**
```bash
# Enable Stereo Mix in Sound Settings, then:
ffmpeg -f dshow -i audio="Stereo Mix" \
  -f mp3 -b:a 192k \
  icecast://source:STREAM_KEY@localhost:8000/live
```

### OBS Studio

1. Open OBS → Settings → Stream
2. Service: Custom
3. Server: `http://localhost:8000/live`
4. Stream Key: (your broadcast key from the admin panel)
5. Start streaming

### Browser Audio Capture

The web broadcaster can capture a browser tab's audio:
1. Go to Broadcast page
2. Click "Start Web Broadcast"
3. Select the tab playing audio
4. The browser captures and streams it

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://radio:radio_secret@localhost:5432/radiolive` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `API_PORT` | API server port | `4000` |
| `JWT_SECRET` | JWT signing secret | (must be set) |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `ICECAST_HOST` | Icecast server host | `localhost` |
| `ICECAST_PORT` | Icecast server port | `8000` |
| `ICECAST_SOURCE_PASSWORD` | Icecast source password | (must be set) |
| `STREAM_MOUNT` | Stream mount point | `/live` |
| `BROADCAST_KEY` | Default broadcast key | (must be set) |

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name radio.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /live {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### HTTPS with Let's Encrypt

```bash
sudo certbot --nginx -d radio.example.com
```

## Project Structure

```
radiolive/
├── apps/
│   ├── web/              # Next.js frontend
│   └── broadcaster/      # Electron broadcaster app
├── services/
│   └── api/              # Node.js API server
├── packages/
│   └── shared/           # Shared types and utilities
├── infra/
│   └── docker/           # Docker configurations
├── docs/                 # Documentation
└── scripts/              # Utility scripts
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Broadcasts
- `GET /api/broadcasts/active` - Get active broadcast
- `GET /api/broadcasts/recent` - Get recent broadcasts
- `GET /api/broadcasts/stats` - Get platform stats
- `POST /api/broadcasts` - Start broadcast (broadcaster+)
- `POST /api/broadcasts/:id/end` - End broadcast

### Chat
- `POST /api/chat/:broadcastId/messages` - Send message
- `DELETE /api/chat/:broadcastId/messages/:messageId` - Delete message
- `POST /api/chat/:broadcastId/ban/:userId` - Ban user (mod+)

### Admin
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id/role` - Change user role
- `GET /api/admin/broadcasts` - Broadcast history
- `GET /api/admin/stats` - Server statistics
- `GET /api/admin/health` - Health check

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_broadcast` | Client → Server | Join broadcast room |
| `leave_broadcast` | Client → Server | Leave broadcast room |
| `chat_message` | Both | Send/receive chat |
| `listener_count` | Server → Client | Updated listener count |
| `metadata_changed` | Server → Client | Track metadata update |
| `stream_started` | Server → Client | Broadcast started |
| `stream_stopped` | Server → Client | Broadcast ended |
| `chat_deleted` | Server → Client | Message removed |

## License

MIT
