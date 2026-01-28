import express from 'express';
import { prisma, io } from '../index';
import { z } from 'zod';

const router = express.Router();

const postSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

// Get all posts
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
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
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
    // Get post with all related data
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: true,
        originalWorkers: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Note: We allow deletion even if used as originalPost
    // The frontend will handle reassignment before calling this endpoint

    // Delete the post (assignments will be cascade deleted)
    await prisma.post.delete({
      where: { id: req.params.id },
    });

    // Emit real-time update for post deletion
    io.emit('post-deleted', {
      postId: req.params.id,
      room: 'main',
    });

    // Emit unassignment events for all workers that were assigned to this post
    post.assignments.forEach((assignment) => {
      io.emit('worker-unassigned', {
        assignmentId: assignment.id,
        room: 'main',
      });
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting post:', error);
    
    // Check for foreign key constraint error
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: 'Ce poste ne peut pas être supprimé car il est utilisé comme poste original par certains travailleurs.' 
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to delete post' 
    });
  }
});

export default router;
