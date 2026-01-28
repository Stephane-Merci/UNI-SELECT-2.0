import express from 'express';
import { prisma } from '../index';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Register manager
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    
    // Check if user exists
    const existing = await prisma.manager.findFirst({
      where: {
        OR: [
          { username: data.username },
          { email: data.email },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const manager = await prisma.manager.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
      },
    });

    const token = jwt.sign({ id: manager.id, username: manager.username }, JWT_SECRET);
    res.status(201).json({ token, manager: { id: manager.id, username: manager.username, email: manager.email } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to register' });
  }
});

// Login manager
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    
    const manager = await prisma.manager.findUnique({
      where: { username: data.username },
    });

    if (!manager) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(data.password, manager.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: manager.id, username: manager.username }, JWT_SECRET);
    res.json({ token, manager: { id: manager.id, username: manager.username, email: manager.email } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to login' });
  }
});

export default router;
