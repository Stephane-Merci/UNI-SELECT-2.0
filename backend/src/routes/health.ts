import express from 'express';
import { prisma } from '../index';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Vérifier la connexion à la base de données
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    });
  }
});

export default router;
