import { Router, Response } from 'express';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { getAllUsers, updateUserRole } from '../lib/auth';
import { getBroadcastHistory, getBroadcastStats } from '../lib/broadcast';
import { pool } from '../lib/db';
import os from 'os';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await getAllUsers();
    res.json({ success: true, data: users });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

router.put('/users/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    if (!['listener', 'broadcaster', 'moderator', 'admin'].includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }
    const user = await updateUserRole(String(req.params.id), role);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

router.get('/broadcasts', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit) || '50'), 200);
    const offset = parseInt(String(req.query.offset) || '0');
    const broadcasts = await getBroadcastHistory(limit, offset);
    res.json({ success: true, data: broadcasts });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get broadcast history' });
  }
});

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const broadcastStats = await getBroadcastStats();
    const memUsage = process.memoryUsage();
    const stats = {
      ...broadcastStats,
      server: {
        cpu: os.loadavg()[0],
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(os.totalmem() / 1024 / 1024),
          percentage: Math.round((memUsage.heapUsed / os.totalmem()) * 100),
        },
        uptime: process.uptime(),
        activeConnections: 0,
      },
    };
    res.json({ success: true, data: stats });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get server stats' });
  }
});

router.get('/health', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      success: true,
      data: {
        status: 'healthy',
        database: 'connected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.json({
      success: false,
      data: {
        status: 'unhealthy',
        database: 'disconnected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;
