import express from 'express';
import { prisma, io } from '../index';
import { z } from 'zod';

const router = express.Router();

const createBookingSchema = z.object({
  name: z.string().min(1),
  effectiveDate: z.string().min(1), // ISO date string
  assignments: z.array(z.object({
    workerId: z.string().min(1),
    postId: z.string().min(1),
  })),
});

const updateBookingSchema = z.object({
  name: z.string().min(1).optional(),
  effectiveDate: z.string().min(1).optional(),
  assignments: z.array(z.object({
    workerId: z.string().min(1),
    postId: z.string().min(1),
  })),
});

// List all bookings (newest first)
router.get('/', async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        assignments: {
          include: {
            worker: { include: { originalPost: true } },
            post: true,
          },
        },
      },
      orderBy: { effectiveDate: 'desc' },
    });
    res.json(bookings);
  } catch (error: any) {
    console.error('Bookings fetch error:', error?.message ?? error);
    const isMissingTable = error?.code === 'P2021' || /does not exist|relation.*does not exist/i.test(String(error?.message ?? ''));
    const msg = isMissingTable
      ? 'Booking tables missing. Run: npx prisma migrate deploy (or prisma/create_booking_tables_if_missing.sql)'
      : 'Failed to fetch bookings';
    res.status(500).json({ error: msg });
  }
});

const putReplacementsSchema = z.object({
  replacements: z.array(z.object({
    postId: z.string().min(1),
    replacement1WorkerId: z.string().nullable().optional(),
    replacement2WorkerId: z.string().nullable().optional(),
    replacement3WorkerId: z.string().nullable().optional(),
    replacement4WorkerId: z.string().nullable().optional(),
  })),
});

// Get replacements for a booking (must be before GET /:id)
router.get('/:id/replacements', async (req, res) => {
  try {
    const list = await prisma.bookingReplacement.findMany({
      where: { bookingId: req.params.id },
      include: {
        post: true,
        replacement1Worker: true,
        replacement2Worker: true,
        replacement3Worker: true,
        replacement4Worker: true,
      },
    });
    res.json(list);
  } catch (error: unknown) {
    console.error('GET /bookings/:id/replacements error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch replacements';
    res.status(500).json({ error: msg });
  }
});

// Normalize empty string to null for optional worker IDs (avoids FK violation)
function toWorkerId(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return value;
}

// Set replacements for a booking (replace all)
router.put('/:id/replacements', async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const data = putReplacementsSchema.parse(req.body);
    await prisma.bookingReplacement.deleteMany({ where: { bookingId: req.params.id } });
    if (data.replacements.length > 0) {
      await prisma.bookingReplacement.createMany({
        data: data.replacements.map((r) => ({
          bookingId: req.params.id,
          postId: r.postId,
          replacement1WorkerId: toWorkerId(r.replacement1WorkerId ?? undefined),
          replacement2WorkerId: toWorkerId(r.replacement2WorkerId ?? undefined),
          replacement3WorkerId: toWorkerId(r.replacement3WorkerId ?? undefined),
          replacement4WorkerId: toWorkerId(r.replacement4WorkerId ?? undefined),
        })),
      });
    }
    const list = await prisma.bookingReplacement.findMany({
      where: { bookingId: req.params.id },
      include: {
        post: true,
        replacement1Worker: true,
        replacement2Worker: true,
        replacement3Worker: true,
        replacement4Worker: true,
      },
    });
    res.json(list);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('PUT /bookings/:id/replacements error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to save replacements';
    res.status(500).json({ error: msg });
  }
});

// Get one booking
router.get('/:id', async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
          include: {
            worker: { include: { originalPost: true } },
            post: true,
          },
        },
      },
    });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Update a booking (replace assignments; unassigned workers are those not in assignments)
router.put('/:id', async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const data = updateBookingSchema.parse(req.body);
    if (data.name !== undefined || data.effectiveDate !== undefined) {
      const updatePayload: { name?: string; effectiveDate?: Date } = {};
      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.effectiveDate !== undefined) {
        const effectiveDate = new Date(data.effectiveDate);
        if (isNaN(effectiveDate.getTime())) {
          return res.status(400).json({ error: 'Invalid effectiveDate' });
        }
        updatePayload.effectiveDate = effectiveDate;
      }
      await prisma.booking.update({
        where: { id: req.params.id },
        data: updatePayload,
      });
    }
    if (data.assignments !== undefined) {
      await prisma.bookingAssignment.deleteMany({ where: { bookingId: req.params.id } });
      if (data.assignments.length > 0) {
        await prisma.bookingAssignment.createMany({
          data: data.assignments.map((a) => ({
            bookingId: req.params.id,
            workerId: a.workerId,
            postId: a.postId,
          })),
        });
      }
    }
    const updated = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
          include: {
            worker: { include: { originalPost: true } },
            post: true,
          },
        },
      },
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Create a new booking (does not change workers)
router.post('/', async (req, res) => {
  try {
    const data = createBookingSchema.parse(req.body);
    const effectiveDate = new Date(data.effectiveDate);
    if (isNaN(effectiveDate.getTime())) {
      return res.status(400).json({ error: 'Invalid effectiveDate' });
    }

    const booking = await prisma.booking.create({
      data: {
        name: data.name,
        effectiveDate,
        assignments: {
          create: data.assignments.map((a) => ({
            workerId: a.workerId,
            postId: a.postId,
          })),
        },
      },
      include: {
        assignments: {
          include: {
            worker: { include: { originalPost: true } },
            post: true,
          },
        },
      },
    });
    res.status(201).json(booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Activate a booking: apply its assignments to workers' originalPostId
router.post('/:id/activate', async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { assignments: true },
    });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    for (const a of booking.assignments) {
      await prisma.worker.update({
        where: { id: a.workerId },
        data: { originalPostId: a.postId },
      });
      io.emit('worker-original-post-updated', { workerId: a.workerId, room: 'main' });
    }

    res.json({ ok: true, applied: booking.assignments.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate booking' });
  }
});

// Delete a booking
router.delete('/:id', async (req, res) => {
  try {
    await prisma.booking.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

export default router;
