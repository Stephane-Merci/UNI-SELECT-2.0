import express from 'express';
import { prisma, io } from '../index';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const router = express.Router();

const machineryCheckSchema = z.object({
  planId: z.string().min(1),
  postId: z.string().min(1),
  workerId: z.string().min(1),
  // Simplified check flow: only done/not done is required.
  checked: z.boolean().optional(),
  // Backward compatibility with previous clients.
  status: z.enum(['GOOD', 'FAULTY', 'UNKNOWN']).optional(),
});

// Get machinery checks for a plan
router.get('/plan/:planId', async (req, res) => {
  try {
    const checks = await prisma.machineryCheck.findMany({
      where: { planId: req.params.planId },
      include: {
        post: true,
        worker: true,
      },
    });
    
    // Map to frontend format
    const mapped = checks.map(dbCheck => ({
      ...dbCheck,
      checked: dbCheck.isDone,
      checkedAt: dbCheck.updatedAt
    }));
    
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch machinery checks' });
  }
});

// Create or update a machinery check
router.post('/check', async (req, res) => {
  try {
    const data = machineryCheckSchema.parse(req.body);

    const include = { post: true, worker: true } as const;
    const checked = data.checked ?? (data.status ? data.status !== 'UNKNOWN' : true);
    const write = {
      isDone: checked,
      // Defect state no longer drives UI workflow; keep false for simplified checks.
      isFaulty: false,
      updatedAt: new Date(),
    };

    const existing = await prisma.machineryCheck.findFirst({
      where: {
        planId: data.planId,
        postId: data.postId,
        workerId: data.workerId,
      },
    });

    const dbCheck = existing
      ? await prisma.machineryCheck.update({
          where: { id: existing.id },
          data: write,
          include,
        })
      : await prisma.machineryCheck.create({
          data: {
            planId: data.planId,
            postId: data.postId,
            workerId: data.workerId,
            ...write,
          },
          include,
        });

    // Map to frontend format
    const check = {
      ...dbCheck,
      checked: dbCheck.isDone,
      checkedAt: dbCheck.updatedAt
    };

    io.emit('machinery-check-updated', { check, room: 'main' });
    res.json(check);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const targetStr = Array.isArray(target) ? target.join(', ') : String(target ?? '');
      if (targetStr.includes('planId') && targetStr.includes('postId') && !targetStr.includes('workerId')) {
        return res.status(503).json({
          error:
            'La base de données impose encore une seule inspection par poste (ancienne contrainte). Exécutez la migration Prisma sur la base utilisée par ce serveur (UNIQUE planId+postId+workerId), ou appliquez le SQL du fichier migrations/20260416120000_machinery_check_unique_per_worker_fix/migration.sql sur la même DATABASE_URL que Render.',
          code: 'MACHINERY_DB_CONSTRAINT_STALE',
        });
      }
    }
    res.status(500).json({ error: 'Failed to update machinery check' });
  }
});

// Manual update of post machinery status (for managers)
router.put('/post/:postId/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['GOOD', 'FAULTY', 'UNKNOWN'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const post = await prisma.post.update({
      where: { id: req.params.postId },
      data: { 
        isMachineryFaulty: status === 'FAULTY',
        machineryStatus: status 
      },
    });

    io.emit('post-updated', { post, room: 'main' });
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update post machinery status' });
  }
});

export default router;
