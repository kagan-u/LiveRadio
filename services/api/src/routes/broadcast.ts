import { Router, Response } from 'express';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { createBroadcast, endBroadcast, getActiveBroadcast, getBroadcast, getRecentBroadcasts, getBroadcastStats } from '../lib/broadcast';
import { getMessages } from '../lib/chat';
import { z } from 'zod';

const router = Router();

const createBroadcastSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

router.get('/active', async (req: any, res: Response) => {
  try {
    const broadcast = await getActiveBroadcast();
    res.json({ success: true, data: broadcast });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get active broadcast' });
  }
});

router.get('/recent', async (req: any, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit) || '10'), 50);
    const broadcasts = await getRecentBroadcasts(limit);
    res.json({ success: true, data: broadcasts });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get recent broadcasts' });
  }
});

router.get('/stats', async (req: any, res: Response) => {
  try {
    const stats = await getBroadcastStats();
    res.json({ success: true, data: stats });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

router.get('/:id', async (req: any, res: Response) => {
  try {
    const broadcast = await getBroadcast(String(req.params.id));
    if (!broadcast) {
      res.status(404).json({ success: false, error: 'Broadcast not found' });
      return;
    }
    res.json({ success: true, data: broadcast });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get broadcast' });
  }
});

router.get('/:id/messages', async (req: any, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit) || '50'), 200);
    const messages = await getMessages(String(req.params.id), limit);
    res.json({ success: true, data: messages });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get messages' });
  }
});

router.post('/', authenticate, requireRole('broadcaster', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const data = createBroadcastSchema.parse(req.body);
    const active = await getActiveBroadcast();
    if (active) {
      res.status(409).json({ success: false, error: 'A broadcast is already active' });
      return;
    }
    const broadcast = await createBroadcast(req.user!.id, data.title, data.description);
    res.status(201).json({ success: true, data: broadcast });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create broadcast' });
  }
});

router.post('/:id/end', authenticate, requireRole('broadcaster', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const broadcast: any = await getBroadcast(id);
    if (!broadcast) {
      res.status(404).json({ success: false, error: 'Broadcast not found' });
      return;
    }
    if (broadcast.broadcaster_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Not your broadcast' });
      return;
    }
    const ended = await endBroadcast(id);
    res.json({ success: true, data: ended });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to end broadcast' });
  }
});

export default router;
