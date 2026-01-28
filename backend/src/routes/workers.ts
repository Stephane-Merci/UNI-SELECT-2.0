import express from 'express';
import { prisma, io } from '../index';
import { WorkerType } from '@prisma/client';
import { z } from 'zod';

const router = express.Router();

// Only these 6 types can be used for Worker.type (origin type) and in create-worker dropdown
const ORIGIN_TYPES: WorkerType[] = [
  WorkerType.PERMANENT_JOUR,
  WorkerType.PERMANENT_SOIR,
  WorkerType.OCCASIONEL_DU_JOUR,
  WorkerType.OCCASIONEL_SOIR,
  WorkerType.MOBILITE_DU_JOUR,
  WorkerType.MOBILITE_DU_SOIR,
];

const workerSchema = z.object({
  anciennete: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(ORIGIN_TYPES as unknown as [string, ...string[]]),
  originalPostId: z.string().min(1),
});

// Get all workers
router.get('/', async (req, res) => {
  try {
    const workers = await prisma.worker.findMany({
      include: {
        originalPost: true,
        assignments: {
          include: {
            post: true,
          },
          orderBy: {
            assignedAt: 'desc',
          },
        },
      },
    });
    res.json(workers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

// Get worker by ID
router.get('/:id', async (req, res) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { id: req.params.id },
      include: {
        originalPost: true,
        assignments: {
          include: {
            post: true,
          },
        },
      },
    });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    res.json(worker);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch worker' });
  }
});

// Create worker
router.post('/', async (req, res) => {
  try {
    const data = workerSchema.parse(req.body);
    
    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: data.originalPostId },
    });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const worker = await prisma.worker.create({
      data,
      include: {
        originalPost: true,
      },
    });
    res.status(201).json(worker);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create worker' });
  }
});

// Update worker
router.put('/:id', async (req, res) => {
  try {
    const updateSchema = workerSchema.partial();
    const data = updateSchema.parse(req.body);
    
    const worker = await prisma.worker.update({
      where: { id: req.params.id },
      data,
      include: {
        originalPost: true,
      },
    });
    
    // Emit real-time update if originalPost was changed
    if (data.originalPostId) {
      io.emit('worker-original-post-updated', {
        worker,
        room: 'main',
      });
    }
    
    res.json(worker);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to update worker' });
  }
});

// Update worker (origin) type — only accepts one of the 6 origin types
router.patch('/:id/type', async (req, res) => {
  try {
    const { type } = req.body;
    if (!ORIGIN_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Worker type must be one of the 6 origin types' });
    }

    const worker = await prisma.worker.update({
      where: { id: req.params.id },
      data: { type },
      include: {
        originalPost: true,
      },
    });
    res.json(worker);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update worker type' });
  }
});

// Delete worker
router.delete('/:id', async (req, res) => {
  try {
    await prisma.worker.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete worker' });
  }
});

export default router;
