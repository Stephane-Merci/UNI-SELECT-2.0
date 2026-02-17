import express from 'express';
import { prisma } from '../index';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';
import { sendMail } from '../utils/mail';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const requestResetSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
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
      return res.status(400).json({ error: 'Cet utilisateur ou email existe déjà.' });
    }

    // Generate a random initial password (will be reset by user)
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create token for setting password (valid for 7 days)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

    const manager = await prisma.manager.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
        resetToken,
        resetTokenExpiry,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Send invitation email
    await sendMail(
      data.email,
      'Création de votre compte - UNISELECT 2.0',
      `Bonjour ${data.username},\n\nUn compte manager a été créé pour vous sur UNISELECT 2.0.\n\nIdentifiant: ${data.username}\n\nVeuillez cliquer sur le lien suivant pour définir votre mot de passe (valide 1 semaine) :\n\n${resetUrl}`,
      `<p>Bonjour <strong>${data.username}</strong>,</p>
<p>Un compte manager a été créé pour vous sur <strong>UNISELECT 2.0</strong>.</p>
<p><strong>Identifiant:</strong> ${data.username}</p>
<p>Veuillez cliquer sur le bouton ci-dessous pour définir votre mot de passe (ce lien est valide pendant 1 semaine) :</p>
<p><a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Définir mon mot de passe</a></p>
<p>Si vous n'avez pas demandé ce compte, vous pouvez ignorer cet email.</p>`
    );

    res.status(201).json({
      message: 'Compte créé. Un email d\'invitation a été envoyé à l\'utilisateur.',
      manager: { id: manager.id, username: manager.username, email: manager.email }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides. Vérifiez le format de l\'email.' });
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

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = requestResetSchema.parse(req.body);

    const manager = await prisma.manager.findUnique({
      where: { email },
    });

    if (!manager) {
      // Don't reveal if email exists for security, just return success
      return res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.manager.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    await sendMail(
      email,
      'Réinitialisation de votre mot de passe - UNISELECT 2.0',
      `Bonjour,\n\nVous avez demandé la réinitialisation de votre mot de passe. Veuillez cliquer sur le lien suivant (valide 1 heure) :\n\n${resetUrl}`,
      `<p>Bonjour,</p><p>Vous avez demandé la réinitialisation de votre mot de passe. Veuillez cliquer sur le bouton suivant (valide 1 heure) :</p><p><a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Réinitialiser mon mot de passe</a></p><p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.</p>`
    );

    res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    const manager = await prisma.manager.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!manager) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.manager.update({
      where: { id: manager.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Change password (auth required)
router.post('/change-password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const manager = await prisma.manager.findUnique({
      where: { id: userId },
    });

    if (!manager) return res.status(404).json({ error: 'Manager not found' });

    const valid = await bcrypt.compare(currentPassword, manager.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.manager.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;

