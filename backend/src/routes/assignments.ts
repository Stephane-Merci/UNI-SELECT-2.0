import express from 'express';
import { prisma, io } from '../index';
import { z } from 'zod';

const router = express.Router();

const assignmentSchema = z.object({
  planId: z.string().min(1),
  workerId: z.string().min(1),
  postId: z.string().min(1),
  assignedBy: z.string().optional(),
});

// Get all assignments (optionally filtered by plan)
router.get('/', async (req, res) => {
  try {
    const { planId } = req.query;
    const assignments = await prisma.assignment.findMany({
      where: planId ? { planId: planId as string } : undefined,
      include: {
        plan: true,
        worker: {
          include: {
            originalPost: true,
          },
        },
        post: true,
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Create assignment (assign worker to post in a plan)
router.post('/', async (req, res) => {
  try {
    const data = assignmentSchema.parse(req.body);
    
    // Verify plan, worker and post exist
    const [plan, worker, post] = await Promise.all([
      prisma.plan.findUnique({ where: { id: data.planId } }),
      prisma.worker.findUnique({ where: { id: data.workerId } }),
      prisma.post.findUnique({ where: { id: data.postId } }),
    ]);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if worker is already assigned in this plan
    const existingAssignment = await prisma.assignment.findUnique({
      where: {
        planId_workerId: {
          planId: data.planId,
          workerId: data.workerId,
        },
      },
    });

    if (existingAssignment) {
      // Update existing assignment
      const assignment = await prisma.assignment.update({
        where: { id: existingAssignment.id },
        data: {
          postId: data.postId,
          assignedBy: data.assignedBy,
        },
        include: {
          plan: true,
          worker: {
            include: {
              originalPost: true,
            },
          },
          post: true,
        },
      });

      // Emit real-time update
      io.emit('worker-assigned', {
        assignment,
        planId: data.planId,
        room: 'main',
      });

      return res.json(assignment);
    }

    // Create new assignment
    const assignment = await prisma.assignment.create({
      data,
      include: {
        plan: true,
        worker: {
          include: {
            originalPost: true,
          },
        },
        post: true,
      },
    });

    // Emit real-time update
    io.emit('worker-assigned', {
      assignment,
      planId: data.planId,
      room: 'main',
    });

    res.status(201).json(assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// Remove assignment
router.delete('/:id', async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await prisma.assignment.delete({
      where: { id: req.params.id },
    });

    // Emit real-time update
    io.emit('worker-unassigned', {
      assignmentId: req.params.id,
      planId: assignment.planId,
      room: 'main',
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

export default router;
