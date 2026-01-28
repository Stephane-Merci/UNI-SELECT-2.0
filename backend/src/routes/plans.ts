import express from 'express';
import { prisma, io } from '../index';
import { z } from 'zod';

const router = express.Router();

const planSchema = z.object({
  name: z.string().min(1),
  date: z.string().optional(),
  createdBy: z.string().optional(),
});

// Get all plans
router.get('/', async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      include: {
        assignments: {
          include: {
            worker: {
              include: {
                originalPost: true,
              },
            },
            post: true,
          },
        },
        workerPresences: {
          include: {
            worker: {
              include: {
                originalPost: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Get plans by createdAt range (for exports and bulk operations)
router.get('/range', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (typeof start !== 'string' || typeof end !== 'string') {
      return res.status(400).json({ error: 'start and end query params are required (ISO date strings)' });
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    const plans = await prisma.plan.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        name: true,
        date: true,
        createdAt: true,
      },
    });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plans by range' });
  }
});

// Get plan by ID
router.get('/:id', async (req, res) => {
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
          include: {
            worker: {
              include: {
                originalPost: true,
              },
            },
            post: true,
          },
        },
        workerPresences: {
          include: {
            worker: {
              include: {
                originalPost: true,
              },
            },
          },
        },
      },
    });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

// Create new plan
router.post('/', async (req, res) => {
  try {
    // Check if prisma.plan exists (client needs to be regenerated)
    if (!prisma.plan) {
      return res.status(500).json({ 
        error: 'Prisma client not regenerated. Please run: npx prisma generate',
        details: 'The Plan model was added to the schema but Prisma client needs to be regenerated'
      });
    }
    
    const data = planSchema.parse(req.body);
    const plan = await prisma.plan.create({
      data: {
        name: data.name,
        date: data.date ? new Date(data.date) : null,
        createdBy: data.createdBy,
      },
    });

    // Initialize worker presences with their default types
    try {
      const workers = await prisma.worker.findMany();
      if (workers.length > 0) {
        await prisma.workerPresence.createMany({
          data: workers.map((worker) => ({
            planId: plan.id,
            workerId: worker.id,
            type: worker.type,
          })),
        });
      }
    } catch (presenceError: any) {
      console.error('Error creating worker presences:', presenceError);
      // If presences fail, we still want to return the plan
      // but log the error
      if (presenceError?.code === 'P2003' || presenceError?.code === 'P2014') {
        throw new Error('Database schema error. Please run: npx prisma migrate dev');
      }
      throw presenceError;
    }

    // Fetch complete plan with all relations
    const completePlan = await prisma.plan.findUnique({
      where: { id: plan.id },
      include: {
        assignments: {
          include: {
            worker: {
              include: {
                originalPost: true,
              },
            },
            post: true,
          },
        },
        workerPresences: {
          include: {
            worker: {
              include: {
                originalPost: true,
              },
            },
          },
        },
      },
    });

    // Emit real-time update
    io.emit('plan-created', {
      plan: completePlan,
      room: 'main',
    });

    res.status(201).json(completePlan);
  } catch (error: any) {
    console.error('Error creating plan:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    // Provide more detailed error message
    const errorMessage = error?.message || 'Failed to create plan';
    const isDatabaseError = error?.code === 'P2002' || error?.code === 'P2003' || error?.code === 'P2014';
    
    if (isDatabaseError) {
      return res.status(500).json({ 
        error: 'Database error. Please ensure migrations have been run: npx prisma migrate dev',
        details: errorMessage 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create plan',
      details: errorMessage 
    });
  }
});

// Delete plans by date range (createdAt between start and end)
router.post('/bulk-delete', async (req, res) => {
  try {
    const { start, end } = req.body;
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required (ISO strings)' });
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    const result = await prisma.plan.deleteMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
    io.emit('plan-updated', { room: 'main' });
    res.json({ deleted: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete plans' });
  }
});

// Copy plan from another plan
router.post('/:id/copy', async (req, res) => {
  try {
    const { name, date } = req.body;
    const sourcePlan = await prisma.plan.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: true,
        workerPresences: true,
      },
    });

    if (!sourcePlan) {
      return res.status(404).json({ error: 'Source plan not found' });
    }

    // Create new plan
    const newPlan = await prisma.plan.create({
      data: {
        name: name || `${sourcePlan.name} (Copie)`,
        date: date ? new Date(date) : null,
        createdBy: req.body.createdBy,
      },
    });

    // Copy worker presences
    // Get all workers to ensure we have presences for all of them
    const allWorkers = await prisma.worker.findMany();
    const presenceMap = new Map(
      sourcePlan.workerPresences.map((p) => [p.workerId, p.type])
    );

    // Create presences for all workers (use source plan's type or worker's default type)
    await prisma.workerPresence.createMany({
      data: allWorkers.map((worker) => ({
        planId: newPlan.id,
        workerId: worker.id,
        type: presenceMap.get(worker.id) || worker.type,
      })),
    });

    // Copy assignments
    if (sourcePlan.assignments.length > 0) {
      await prisma.assignment.createMany({
        data: sourcePlan.assignments.map((assignment) => ({
          planId: newPlan.id,
          workerId: assignment.workerId,
          postId: assignment.postId,
          assignedBy: assignment.assignedBy,
        })),
      });
    }

    // Fetch the complete new plan
    const completePlan = await prisma.plan.findUnique({
      where: { id: newPlan.id },
      include: {
        assignments: {
          include: {
            worker: {
              include: {
                originalPost: true,
              },
            },
            post: true,
          },
        },
        workerPresences: {
          include: {
            worker: {
              include: {
                originalPost: true,
              },
            },
          },
        },
      },
    });

    // Emit real-time update
    io.emit('plan-created', {
      plan: completePlan,
      room: 'main',
    });

    res.status(201).json(completePlan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to copy plan' });
  }
});

// Update plan
router.put('/:id', async (req, res) => {
  try {
    const data = planSchema.partial().parse(req.body);
    const plan = await prisma.plan.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        date: data.date ? new Date(data.date) : undefined,
      },
      include: {
        assignments: {
          include: {
            worker: {
              include: {
                originalPost: true,
              },
            },
            post: true,
          },
        },
        workerPresences: {
          include: {
            worker: {
              include: {
                originalPost: true,
              },
            },
          },
        },
      },
    });

    // Emit real-time update
    io.emit('plan-updated', {
      plan,
      room: 'main',
    });

    res.json(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// Delete plan
router.delete('/:id', async (req, res) => {
  try {
    await prisma.plan.delete({
      where: { id: req.params.id },
    });

    // Emit real-time update
    io.emit('plan-deleted', {
      planId: req.params.id,
      room: 'main',
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

// Update worker presence in a plan
router.put('/:id/presence/:workerId', async (req, res) => {
  try {
    const { type } = req.body;
    const { WorkerType } = await import('@prisma/client');
    
    if (!Object.values(WorkerType).includes(type)) {
      return res.status(400).json({ error: 'Invalid worker type' });
    }

    const presence = await prisma.workerPresence.upsert({
      where: {
        planId_workerId: {
          planId: req.params.id,
          workerId: req.params.workerId,
        },
      },
      update: {
        type,
      },
      create: {
        planId: req.params.id,
        workerId: req.params.workerId,
        type,
      },
      include: {
        worker: {
          include: {
            originalPost: true,
          },
        },
      },
    });

    // Emit real-time update
    io.emit('worker-presence-updated', {
      presence,
      planId: req.params.id,
      room: 'main',
    });

    res.json(presence);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update worker presence' });
  }
});

export default router;
