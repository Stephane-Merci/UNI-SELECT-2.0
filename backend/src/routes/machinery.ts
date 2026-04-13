import express from 'express';
import { prisma, io } from '../index';
import { z } from 'zod';

const router = express.Router();

const machineryCheckSchema = z.object({
  planId: z.string().min(1),
  postId: z.string().min(1),
  workerId: z.string().min(1),
  status: z.enum(['GOOD', 'FAULTY', 'UNKNOWN']),
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
      status: dbCheck.isDone ? (dbCheck.isFaulty ? 'FAULTY' : 'GOOD') : 'UNKNOWN',
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
    
    const dbCheck = await prisma.machineryCheck.upsert({
      where: {
        planId_postId: {
          planId: data.planId,
          postId: data.postId,
        },
      },
      update: {
        workerId: data.workerId,
        isDone: true,
        isFaulty: data.status === 'FAULTY',
        updatedAt: new Date(),
      },
      create: {
        planId: data.planId,
        postId: data.postId,
        workerId: data.workerId,
        isDone: true,
        isFaulty: data.status === 'FAULTY',
      },
      include: {
        post: true,
        worker: true,
      }
    });

    // Map to frontend format
    const check = {
      ...dbCheck,
      status: dbCheck.isDone ? (dbCheck.isFaulty ? 'FAULTY' : 'GOOD') : 'UNKNOWN',
      checkedAt: dbCheck.updatedAt
    };

    // If the status is FAULTY, update the post's global machinery status
    if (data.status === 'FAULTY') {
      const updatedPost = await prisma.post.update({
        where: { id: data.postId },
        data: { isMachineryFaulty: true, machineryStatus: 'FAULTY' },
      });
      
      // Emit real-time update for post
      io.emit('post-updated', { post: updatedPost, room: 'main' });
    }
        // If it was FAULTY, maybe we keep it FAULTY until a manager manually fixes it in Admin?
        // Actually, the user says: "From there, for future plans created, in the machinery check page, faulty machineries should display as faulty unless changed by the manager there in that page or in the administration post table page"
        // So if a worker says GOOD, it doesn't necessarily mean the FAULTY state in Admin is gone.
        // Wait, the user says: "If the feedback is falsy machinery, it should show in the admin page... From there, for future plans created... faulty machineries should display as faulty unless changed by the manager"
        // This implies that once it's FAULTY, it stays FAULTY until a manager changes it.
        // But if a worker checks it and it's GOOD *today*, should it update the global status?
        // "unless changed by the manager there in that page" -> "that page" is machinery check page.
        // "unless changed by the manager there in that page" -> "that page" is machinery check page.
        // So maybe managers CAN change it in the machinery check page too.

    io.emit('machinery-check-updated', { check, room: 'main' });
    res.json(check);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
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
