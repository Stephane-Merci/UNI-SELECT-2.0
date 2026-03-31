import express from 'express';
import { prisma } from '../index';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const registerSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  canEdit: z.boolean().default(true),
  canPrint: z.boolean().default(true),
  canCreateAccounts: z.boolean().default(true),
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
    const existing = await prisma.manager.findUnique({
      where: { username: data.username },
    });

    if (existing) {
      return res.status(400).json({ error: 'Cet utilisateur existe déjà.' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const manager = await prisma.manager.create({
      data: {
        username: data.username,
        email: `${data.username}@uniselect.local`, 
        passwordHash,
        canEdit: data.canEdit,
        canPrint: data.canPrint,
        canCreateAccounts: data.canCreateAccounts,
      },
    });

    res.status(201).json({
      message: 'Compte créé avec succès.',
      manager: { 
        id: manager.id, 
        username: manager.username,
        canEdit: manager.canEdit,
        canPrint: manager.canPrint,
        canCreateAccounts: manager.canCreateAccounts
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides. Le mot de passe doit faire au moins 6 caractères.' });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
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
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const valid = await bcrypt.compare(data.password, manager.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const tokenPayload = { 
      id: manager.id, 
      username: manager.username,
      canEdit: manager.canEdit,
      canPrint: manager.canPrint,
      canCreateAccounts: manager.canCreateAccounts
    };
    
    const token = jwt.sign(tokenPayload, JWT_SECRET);

    res.json({ 
      token, 
      manager: { 
        id: manager.id, 
        username: manager.username,
        canEdit: manager.canEdit,
        canPrint: manager.canPrint,
        canCreateAccounts: manager.canCreateAccounts
      } 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to login' });
  }
});

export default router;


