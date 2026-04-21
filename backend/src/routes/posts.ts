import express from 'express';
import { prisma, io } from '../index';
import { z } from 'zod';

const router = express.Router();

const postSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  needsMachinery: z.boolean().optional(),
  machineryStatus: z.string().optional(),
});

const deletePostBodySchema = z.object({
  reassignOriginalPost: z.record(z.string().min(1), z.string().min(1)).optional(),
});

// Order posts: PIC* first, MET* second, then others — each group alphabetically by name
function postSortOrder(name: string): [number, string] {
  const upper = (name || '').toUpperCase();
  if (upper.startsWith('PIC')) return [0, name];
  if (upper.startsWith('MET')) return [1, name];
  return [2, name];
}

// Get all posts (ordered: PIC first, MET second, then rest alphabetically)
router.get('/', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      include: {
        assignments: {
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
    posts.sort((a, b) => {
      const [rankA, nameA] = postSortOrder(a.name);
      const [rankB, nameB] = postSortOrder(b.name);
      if (rankA !== rankB) return rankA - rankB;
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Preview who blocks post deletion (must be registered before GET /:id)
router.get('/:id/delete-impact', async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, name: true },
    });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const workersUsingAsOriginal = await prisma.worker.findMany({
      where: { originalPostId: postId },
      select: { id: true, name: true, anciennete: true },
      orderBy: { name: 'asc' },
    });

    const activeBooking = await prisma.booking.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    let bookingAssignmentsOnThisPost: {
      workerId: string;
      workerName: string;
      anciennete: string;
    }[] = [];

    if (activeBooking) {
      const rows = await prisma.bookingAssignment.findMany({
        where: { bookingId: activeBooking.id, postId },
        include: { worker: { select: { name: true, anciennete: true } } },
      });
      bookingAssignmentsOnThisPost = rows.map((r) => ({
        workerId: r.workerId,
        workerName: r.worker.name,
        anciennete: r.worker.anciennete,
      }));
    }

    res.json({
      post,
      workersUsingAsOriginal,
      activeBooking,
      bookingAssignmentsOnThisPost,
    });
  } catch (error) {
    console.error('GET /posts/:id/delete-impact error:', error);
    res.status(500).json({ error: 'Failed to load delete impact' });
  }
});

// Get post by ID
router.get('/:id', async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
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
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Create post
router.post('/', async (req, res) => {
  try {
    const data = postSchema.parse(req.body);
    const post = await prisma.post.create({ data });
    res.status(201).json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Update post
router.put('/:id', async (req, res) => {
  try {
    const data = postSchema.partial().parse(req.body);
    const post = await prisma.post.update({
      where: { id: req.params.id },
      data,
    });
    
    // Emit real-time update
    io.emit('post-updated', {
      post,
      room: 'main',
    });
    
    res.json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
router.delete('/:id', async (req, res) => {
  try {
    const postId = req.params.id;

    const body = deletePostBodySchema.safeParse(req.body ?? {});
    if (!body.success) {
      return res.status(400).json({ error: body.error.errors });
    }
    const reassignOriginalPost = body.data.reassignOriginalPost;

    // Get post with all related data
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        assignments: true,
        originalWorkers: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const workersNeedingReassign = await prisma.worker.findMany({
      where: { originalPostId: postId },
      select: { id: true },
    });
    const workerIdsNeeding = workersNeedingReassign.map((w) => w.id);

    if (workerIdsNeeding.length > 0) {
      if (!reassignOriginalPost || Object.keys(reassignOriginalPost).length === 0) {
        return res.status(400).json({
          code: 'REASSIGNMENT_REQUIRED',
          error:
            'Des travailleurs ont ce poste comme poste original. Indiquez un nouveau poste pour chacun avant suppression.',
          workerIds: workerIdsNeeding,
        });
      }
      for (const wid of workerIdsNeeding) {
        const newPostId = reassignOriginalPost[wid];
        if (!newPostId || newPostId === postId) {
          return res.status(400).json({
            error: `Nouveau poste manquant ou invalide pour le travailleur ${wid}.`,
          });
        }
      }
      const newPostIds = [...new Set(Object.values(reassignOriginalPost))];
      const existing = await prisma.post.count({
        where: { id: { in: newPostIds } },
      });
      if (existing !== newPostIds.length) {
        return res.status(400).json({ error: 'Un ou plusieurs postes cibles sont invalides.' });
      }
    }

    const activeBooking = await prisma.booking.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      for (const wid of workerIdsNeeding) {
        const newPostId = reassignOriginalPost![wid];
        await tx.worker.update({
          where: { id: wid },
          data: { originalPostId: newPostId },
        });
        await tx.bookingAssignment.updateMany({
          where: { workerId: wid, postId },
          data: { postId: newPostId },
        });
      }

      await tx.post.delete({ where: { id: postId } });
    });

    io.emit('post-deleted', {
      postId,
      room: 'main',
    });

    if (workerIdsNeeding.length > 0) {
      io.emit('worker-original-post-updated', { room: 'main' });
    }
    if (activeBooking && workerIdsNeeding.length > 0) {
      io.emit('booking-updated', { bookingId: activeBooking.id, room: 'main' });
    }

    post.assignments.forEach((assignment) => {
      io.emit('worker-unassigned', {
        assignmentId: assignment.id,
        room: 'main',
      });
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting post:', error);

    const msg = String(error?.message ?? '');
    if (
      error.code === 'P2003' ||
      msg.includes('Worker_originalPostId_fkey') ||
      msg.includes('23001')
    ) {
      return res.status(400).json({
        error:
          'Ce poste ne peut pas être supprimé : il est encore référencé. Vérifiez les réaffectations ou les réservations.',
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to delete post',
    });
  }
});

export default router;
