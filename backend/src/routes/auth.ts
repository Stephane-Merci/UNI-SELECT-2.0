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

// List all managers (Only should be allowed by managers who can create accounts)
router.get('/', async (req, res) => {
  try {
    const managers = await prisma.manager.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        canEdit: true,
        canPrint: true,
        canCreateAccounts: true,
        createdAt: true,
      },
      orderBy: {
        username: 'asc',
      },
    });
    res.json(managers);
  } catch (error) {
    console.error('List managers error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des managers.' });
  }
});

// Delete manager by username
router.delete('/:username', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { username } = req.params;
    const currentUser = req.user;

    // Check if current user has permission to manage accounts
    const manager = await prisma.manager.findUnique({
      where: { id: currentUser?.id },
    });

    if (!manager || !manager.canCreateAccounts) {
      return res.status(403).json({ error: "Vous n'avez pas la permission de supprimer des comptes." });
    }

    // Prevent deleting itself
    if (manager.username === username) {
      return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
    }

    // Check if target user exists
    const target = await prisma.manager.findUnique({
      where: { username },
    });

    if (!target) {
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }

    await prisma.manager.delete({
      where: { username },
    });

    res.json({ message: `Le compte '${username}' a été supprimé avec succès.` });
  } catch (error) {
    console.error('Delete manager error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du compte.' });
  }
});

// Update manager permissions by username
router.put('/:username', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { username } = req.params;
    const { canEdit, canPrint, canCreateAccounts } = req.body;
    const currentUser = req.user;

    // Check if current user has permission to manage accounts
    const admin = await prisma.manager.findUnique({
      where: { id: currentUser?.id },
    });

    if (!admin || !admin.canCreateAccounts) {
      return res.status(403).json({ error: "Vous n'avez pas la permission de modifier les comptes." });
    }

    // Check if target user exists
    const target = await prisma.manager.findUnique({
      where: { username },
    });

    if (!target) {
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }

    // Prevent modifying own 'canCreateAccounts' to avoid locking yourself out
    const finalCanCreateAccounts = admin.username === username ? true : canCreateAccounts;

    const updated = await prisma.manager.update({
      where: { username },
      data: {
        canEdit: canEdit !== undefined ? canEdit : target.canEdit,
        canPrint: canPrint !== undefined ? canPrint : target.canPrint,
        canCreateAccounts: finalCanCreateAccounts !== undefined ? finalCanCreateAccounts : target.canCreateAccounts,
      },
    });

    res.json({ 
      message: `Permissions du compte '${username}' mises à jour.`,
      manager: {
        id: updated.id,
        username: updated.username,
        canEdit: updated.canEdit,
        canPrint: updated.canPrint,
        canCreateAccounts: updated.canCreateAccounts
      }
    });
  } catch (error) {
    console.error('Update manager error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des permissions.' });
  }
});

export default router;


