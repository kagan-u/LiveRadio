import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { sendMessage, deleteMessage, banUser } from '../lib/chat';

const router = Router();

router.post('/:broadcastId/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const broadcastId = String(req.params.broadcastId);
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Message content required' });
      return;
    }

    const message = await sendMessage(
      broadcastId,
      req.user!.id,
      req.user!.username,
      content.trim(),
      ['moderator', 'admin'].includes(req.user!.role)
    );

    if (!message) {
      res.status(429).json({ success: false, error: 'Rate limited or spam detected' });
      return;
    }

    res.status(201).json({ success: true, data: message });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

router.delete('/:broadcastId/messages/:messageId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await deleteMessage(String(req.params.messageId), req.user!.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Message not found or unauthorized' });
      return;
    }
    res.json({ success: true, message: 'Message deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

router.post('/:broadcastId/ban/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!['moderator', 'admin'].includes(req.user!.role)) {
      res.status(403).json({ success: false, error: 'Moderator or admin required' });
      return;
    }
    await banUser(String(req.params.broadcastId), String(req.params.userId));
    res.json({ success: true, message: 'User banned' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to ban user' });
  }
});

export default router;
