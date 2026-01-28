import express from 'express';
import { prisma } from '../index';
import * as XLSX from 'xlsx';

const router = express.Router();

// Export workers to Excel
router.get('/workers', async (req, res) => {
  try {
    const workers = await prisma.worker.findMany({
      include: {
        originalPost: true,
        assignments: {
          include: {
            post: true,
          },
        },
      },
    });

    const data = workers.map(worker => ({
      'Ancienneté': worker.anciennete,
      'Nom': worker.name,
      'Type': worker.type,
      'Poste Original': worker.originalPost.name,
      'Postes Assignés': worker.assignments.map(a => a.post.name).join(', '),
      'Date de Création': worker.createdAt.toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Workers');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=workers.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export workers' });
  }
});

// Export plans by date range (createdAt between start and end) – summary or unused by UI
router.get('/plans', async (req, res) => {
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
      orderBy: { createdAt: 'asc' },
    });
    const data = plans.map((plan) => ({
      'Nom': plan.name,
      'Date du plan': plan.date ? new Date(plan.date).toISOString().split('T')[0] : '',
      'Créé le': new Date(plan.createdAt).toISOString().split('T')[0],
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plans');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plans.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export plans' });
  }
});

// Export posts to Excel
router.get('/posts', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      include: {
        assignments: {
          include: {
            worker: true,
          },
        },
      },
    });

    const data = posts.map(post => ({
      'Nom': post.name,
      'Description': post.description || '',
      'Travailleurs Assignés': post.assignments.map(a => `${a.worker.name} (${a.worker.anciennete})`).join(', '),
      'Nombre de Travailleurs': post.assignments.length,
      'Date de Création': post.createdAt.toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Posts');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=posts.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export posts' });
  }
});

// Export a single plan as Excel with 2 sheets: Travailleurs & Postes
router.get('/plan/:id', async (req, res) => {
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
          include: {
            worker: { include: { originalPost: true } },
            post: true,
          },
        },
        workerPresences: {
          include: {
            worker: { include: { originalPost: true } },
          },
        },
      },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Load all workers so that even those without presence/assignments appear
    const allWorkers = await prisma.worker.findMany({
      include: {
        originalPost: true,
      },
      orderBy: {
        anciennete: 'asc',
      },
    });

    const baseName =
      plan.name?.trim() ||
      (plan.date ? new Date(plan.date).toISOString().split('T')[0] : plan.id.slice(0, 8));
    const safeBase = baseName.replace(/[/\\?*\[\]:]/g, '_').slice(0, 40);

    const workbook = XLSX.utils.book_new();

    // Map workerId -> array of assigned post names in this plan
    const postsByWorkerId = new Map<string, string[]>();
    for (const a of plan.assignments) {
      const list = postsByWorkerId.get(a.workerId) || [];
      list.push(a.post.name);
      postsByWorkerId.set(a.workerId, list);
    }

    const presenceByWorkerId = new Map<string, string>();
    for (const p of plan.workerPresences) {
      presenceByWorkerId.set(p.workerId, p.type);
    }

    // Sheet 1: workers for this plan
    const workerRows = allWorkers.map((w) => {
      const posts = postsByWorkerId.get(w.id) || [];
      return {
        'Ancienneté': w.anciennete,
        'Nom': w.name,
        'Type': presenceByWorkerId.get(w.id) || w.type,
        'Poste Original': w.originalPost?.name || '',
        'Postes Assignés': posts.join(', '), // empty if no assignments
      };
    });

    const workerSheet =
      workerRows.length > 0
        ? XLSX.utils.json_to_sheet(workerRows)
        : XLSX.utils.aoa_to_sheet([['Ancienneté', 'Nom', 'Type', 'Poste Original', 'Postes Assignés']]);
    XLSX.utils.book_append_sheet(workbook, workerSheet, 'Travailleurs');

    // Sheet 2: posts for this plan
    const postsById = new Map<
      string,
      { name: string; description: string | null; assignments: typeof plan.assignments }
    >();
    for (const a of plan.assignments) {
      const key = a.postId;
      const existing = postsById.get(key) || {
        name: a.post.name,
        description: a.post.description,
        assignments: [] as typeof plan.assignments,
      };
      (existing.assignments as any).push(a);
      postsById.set(key, existing);
    }

    const postRows = Array.from(postsById.values()).map((p) => ({
      'Nom': p.name,
      'Description': p.description || '',
      'Travailleurs Assignés': (p.assignments as any[]).map(
        (a) => `${a.worker.name} (${a.worker.anciennete})`
      ).join(', '),
      'Nombre de Travailleurs': (p.assignments as any[]).length,
    }));

    const postsSheet =
      postRows.length > 0
        ? XLSX.utils.json_to_sheet(postRows)
        : XLSX.utils.aoa_to_sheet([
            ['Nom', 'Description', 'Travailleurs Assignés', 'Nombre de Travailleurs'],
          ]);
    XLSX.utils.book_append_sheet(workbook, postsSheet, 'Postes');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(safeBase)}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export plan' });
  }
});

export default router;
