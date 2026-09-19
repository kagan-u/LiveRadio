import { Router, Request, Response } from 'express';
import { createUser, authenticateUser, generateToken } from '../lib/auth';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const user = await createUser(data);
    const token = generateToken(user);
    res.status(201).json({ success: true, data: { user, token } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    if (error.code === '23505') {
      res.status(409).json({ success: false, error: 'Username or email already exists' });
      return;
    }
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await authenticateUser(data.email, data.password);
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }
    const token = generateToken(user);
    res.json({ success: true, data: { user, token } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.get('/me', async (req: any, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }
  res.json({ success: true, data: req.user });
});

export default router;
