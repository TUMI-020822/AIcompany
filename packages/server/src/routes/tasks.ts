import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { tasks, taskSteps } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// GET /companies/:companyId/tasks - list tasks
router.get('/companies/:companyId/tasks', (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const status = req.query.status as string | undefined;

    let query = db.select().from(tasks).where(eq(tasks.companyId, companyId)).orderBy(desc(tasks.createdAt));

    const allTasks = query.all();
    const filtered = status ? allTasks.filter((t) => t.status === status) : allTasks;

    // Add step counts
    const enriched = filtered.map((task) => {
      const steps = db.select().from(taskSteps).where(eq(taskSteps.taskId, task.id)).all();
      const completedSteps = steps.filter((s) => s.status === 'completed').length;
      return {
        ...task,
        totalSteps: steps.length,
        completedSteps,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('[tasks] list error:', err);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// POST /companies/:companyId/tasks - create task
router.post('/companies/:companyId/tasks', (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { name, description, dag, steps } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Task name is required' });
      return;
    }

    const taskId = nanoid();
    const now = new Date().toISOString();

    db.insert(tasks).values({
      id: taskId,
      companyId,
      name,
      description: description || '',
      status: 'pending',
      dag: dag || {},
      createdAt: now,
      completedAt: null,
    }).run();

    // Create task steps if provided
    if (Array.isArray(steps)) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        db.insert(taskSteps).values({
          id: nanoid(),
          taskId,
          agentId: step.agentId || '',
          label: step.label || `Step ${i + 1}`,
          status: 'pending',
          orderIndex: step.orderIndex ?? i,
          input: step.input || {},
          output: null,
          startedAt: null,
          completedAt: null,
        }).run();
      }
    }

    const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    const createdSteps = db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId)).all();

    res.status(201).json({ ...task, steps: createdSteps });
  } catch (err) {
    console.error('[tasks] create error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /tasks/:taskId - get task with steps
router.get('/tasks/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const steps = db.select().from(taskSteps)
      .where(eq(taskSteps.taskId, taskId))
      .orderBy(taskSteps.orderIndex)
      .all();

    res.json({ ...task, steps });
  } catch (err) {
    console.error('[tasks] get error:', err);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// PUT /tasks/:taskId/status - update task status
router.put('/tasks/:taskId/status', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'running', 'completed', 'failed'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be: pending, running, completed, or failed' });
      return;
    }

    const existing = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const updates: Record<string, unknown> = { status };
    if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date().toISOString();
    }

    db.update(tasks)
      .set(updates as any)
      .where(eq(tasks.id, taskId))
      .run();

    const updated = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    res.json(updated);
  } catch (err) {
    console.error('[tasks] update status error:', err);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

export default router;
