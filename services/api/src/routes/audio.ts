import { Router, Response } from 'express';
import http from 'http';

const router = Router();
const ICECAST_HOST = process.env.ICECAST_HOST || 'localhost';
const ICECAST_PORT = parseInt(process.env.ICECAST_PORT || '8000');

// Proxy audio stream from Icecast with CORS headers
router.get('/stream', (req, res) => {
  const url = `http://${ICECAST_HOST}:${ICECAST_PORT}/live`;

  const proxyReq = http.get(url, (proxyRes) => {
    res.writeHead(200, {
      'Content-Type': proxyRes.headers['content-type'] || 'audio/mpeg',
      'Cache-Control': 'no-cache, no-store',
      'Access-Control-Allow-Origin': '*',
      'Connection': 'close',
    });

    proxyRes.pipe(res);

    proxyRes.on('error', () => res.end());
  });

  proxyReq.on('error', () => {
    res.status(502).json({ error: 'Stream not available' });
  });

  req.on('close', () => {
    proxyReq.destroy();
  });
});

// Head request for preload
router.head('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Access-Control-Allow-Origin': '*',
  });
  res.end();
});

export default router;
