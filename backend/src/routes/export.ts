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

// Same order as main posts API: PIC* first, MET* second, then alphabetical
function sortPostsByName<T extends { name: string }>(items: T[]): T[] {
  const order = (name: string): [number, string] => {
    const upper = (name || '').toUpperCase();
    if (upper.startsWith('PIC')) return [0, name];
    if (upper.startsWith('MET')) return [1, name];
    return [2, name];
  };
  return [...items].sort((a, b) => {
    const [rA, nA] = order(a.name);
    const [rB, nB] = order(b.name);
    if (rA !== rB) return rA - rB;
    return nA.localeCompare(nB, undefined, { sensitivity: 'base' });
  });
}

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
    const sortedPosts = sortPostsByName(posts);

    const data = sortedPosts.map(post => ({
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

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

// Export a single plan as Excel with 3 sheets: Travailleurs, Postes, Interaction
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

    // Fetch interaction history (worker post migrations with start/end times)
    let interactions: Array<{ workerId: string; postId: string; startedAt: Date; endedAt: Date | null; worker?: { anciennete: string; name: string } | null; post?: { name: string } | null }> = [];
    try {
      if (typeof (prisma as any).assignmentInteraction?.findMany === 'function') {
        const rows = await (prisma as any).assignmentInteraction.findMany({
          where: { planId: plan.id },
          include: { worker: { select: { anciennete: true, name: true } }, post: { select: { name: true } } },
          orderBy: { startedAt: 'asc' },
        });
        interactions = Array.isArray(rows) ? rows : [];
      }
    } catch (_) {
      // Table or model may not exist; will fall back to assignment-based rows below
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

    const workerById = new Map<string, { anciennete: string; name: string }>();
    for (const w of allWorkers) {
      workerById.set(w.id, { anciennete: w.anciennete, name: w.name });
    }
    const postNameById = new Map<string, string>();
    for (const a of plan.assignments) {
      if (a.post?.name) postNameById.set(a.postId, a.post.name);
    }

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

    const postRows = sortPostsByName(
      Array.from(postsById.values()).map((p) => ({
        name: p.name,
        'Nom': p.name,
        'Description': p.description || '',
        'Travailleurs Assignés': (p.assignments as any[]).map(
          (a) => `${a.worker?.name ?? ''} (${a.worker?.anciennete ?? ''})`
        ).join(', '),
        'Nombre de Travailleurs': (p.assignments as any[]).length,
      }))
    ).map(({ name: _n, ...row }) => row);

    const postsSheet =
      postRows.length > 0
        ? XLSX.utils.json_to_sheet(postRows)
        : XLSX.utils.aoa_to_sheet([
            ['Nom', 'Description', 'Travailleurs Assignés', 'Nombre de Travailleurs'],
          ]);
    XLSX.utils.book_append_sheet(workbook, postsSheet, 'Postes');

    // Sheet 3: Interaction – tracks movement of workers between posts.
    // One row per stint at a post. When a worker is moved: previous row's Fin = move time; new row's Début = same time (same user can appear multiple times).
    const formatTime = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);
    const interactionRows: { Séquence: number; Ancienneté: string; Nom: string; Poste: string; Début: string; Fin: string; 'Durée (min)': number }[] = [];
    const now = new Date();
    const workersWithInteractions = new Set<string>();

    if (interactions.length > 0) {
      const byWorker = new Map<string, typeof interactions>();
      for (const i of interactions) {
        const list = byWorker.get(i.workerId) || [];
        list.push(i);
        byWorker.set(i.workerId, list);
      }
      for (const [, list] of byWorker) {
        list.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
        let totalPrevMs = 0;
        let seq = 0;
        for (const i of list) {
          workersWithInteractions.add(i.workerId);
          seq += 1;
          const start = new Date(i.startedAt);
          let end: Date;
          let durationMs: number;
          if (i.endedAt) {
            end = new Date(i.endedAt);
            durationMs = end.getTime() - start.getTime();
          } else {
            const remainingMs = Math.max(0, EIGHT_HOURS_MS - totalPrevMs);
            end = new Date(Math.min(start.getTime() + remainingMs, now.getTime()));
            durationMs = end.getTime() - start.getTime();
          }
          totalPrevMs += durationMs;
          const workerInfo = i.worker ?? workerById.get(i.workerId);
          const postName = i.post?.name ?? postNameById.get(i.postId) ?? '';
          interactionRows.push({
            Séquence: seq,
            Ancienneté: workerInfo?.anciennete ?? '',
            Nom: workerInfo?.name ?? '',
            Poste: postName,
            Début: formatTime(start),
            Fin: formatTime(end),
            'Durée (min)': Math.round(durationMs / 60000),
          });
        }
      }
    } else {
      // No interaction history: derive one row per current assignment so the sheet has Début/Fin data
      let seq = 0;
      for (const a of plan.assignments) {
        seq += 1;
        const workerInfo = workerById.get(a.workerId);
        const postName = a.post?.name ?? postNameById.get(a.postId) ?? '';
        const start = new Date(a.assignedAt);
        interactionRows.push({
          Séquence: seq,
          Ancienneté: workerInfo?.anciennete ?? '',
          Nom: workerInfo?.name ?? '',
          Poste: postName,
          Début: formatTime(start),
          Fin: formatTime(start),
          'Durée (min)': 0,
        });
        workersWithInteractions.add(a.workerId);
      }
    }

    // Ensure every worker appears at least once (empty Début/Fin only for workers with no assignment)
    for (const w of allWorkers) {
      if (!workersWithInteractions.has(w.id)) {
        interactionRows.push({
          Séquence: 0,
          Ancienneté: w.anciennete,
          Nom: w.name,
          Poste: '',
          Début: '',
          Fin: '',
          'Durée (min)': 0,
        });
      }
    }
    // Sort by Début (empty strings last) so migrations are in chronological order
    interactionRows.sort((a, b) => {
      if (!a.Début && !b.Début) return 0;
      if (!a.Début) return 1;
      if (!b.Début) return -1;
      return a.Début.localeCompare(b.Début);
    });
    const interactionSheet =
      interactionRows.length > 0
        ? XLSX.utils.json_to_sheet(interactionRows)
        : XLSX.utils.aoa_to_sheet([['Séquence', 'Ancienneté', 'Nom', 'Poste', 'Début', 'Fin', 'Durée (min)']]);
    XLSX.utils.book_append_sheet(workbook, interactionSheet, 'Interaction');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(safeBase)}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Export plan error:', error?.message ?? error);
    const message = error?.meta?.cause ?? error?.message ?? 'Failed to export plan';
    res.status(500).json({ error: String(message) });
  }
});

export default router;
