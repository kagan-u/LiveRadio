import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initWebSocket } from './lib/websocket';
import authRoutes from './routes/auth';
import broadcastRoutes from './routes/broadcast';
import chatRoutes from './routes/chat';
import adminRoutes from './routes/admin';
import audioRoutes from './routes/audio';
import { optionalAuth } from './middleware/auth';

const app = express();
const server = createServer(app);
const PORT = parseInt(process.env.API_PORT || '4000');

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const requestCounts = new Map<string, { count: number; resetAt: number }>();

app.use((req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60000 });
    next();
    return;
  }

  if (entry.count > 100) {
    res.status(429).json({ success: false, error: 'Too many requests' });
    return;
  }

  entry.count++;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/broadcasts', optionalAuth, broadcastRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/audio', audioRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Initialize WebSocket
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

export default server;
