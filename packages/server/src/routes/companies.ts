import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { companies, companyEmployees, chatConversations, chatMessages, tasks, taskSteps, customAgents, apiKeys } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

const router = Router();

// GET / - list all companies
router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.select().from(companies).all();
    res.json(rows);
  } catch (err) {
    console.error('[companies] list error:', err);
    res.status(500).json({ error: 'Failed to list companies' });
  }
});

// POST / - create company
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, industry, description, settings } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Company name is required' });
      return;
    }
    const id = nanoid();
    const now = new Date().toISOString();
    db.insert(companies).values({
      id,
      name,
      industry: industry || '',
      description: description || '',
      settings: settings || {},
      createdAt: now,
    }).run();

    const company = db.select().from(companies).where(eq(companies.id, id)).get();
    res.status(201).json(company);
  } catch (err) {
    console.error('[companies] create error:', err);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// GET /:id - get company details with employee count
router.get('/:id', (req: Request, res: Response) => {
  try {
    const company = db.select().from(companies).where(eq(companies.id, req.params.id)).get();
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const employees = db.select().from(companyEmployees)
      .where(eq(companyEmployees.companyId, req.params.id)).all();

    res.json({ ...company, employeeCount: employees.length });
  } catch (err) {
    console.error('[companies] get error:', err);
    res.status(500).json({ error: 'Failed to get company' });
  }
});

// PUT /:id - update company
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.select().from(companies).where(eq(companies.id, req.params.id)).get();
    if (!existing) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const { name, industry, description, settings } = req.body;
    db.update(companies)
      .set({
        name: name ?? existing.name,
        industry: industry ?? existing.industry,
        description: description ?? existing.description,
        settings: settings ?? existing.settings,
      })
      .where(eq(companies.id, req.params.id))
      .run();

    const updated = db.select().from(companies).where(eq(companies.id, req.params.id)).get();
    res.json(updated);
  } catch (err) {
    console.error('[companies] update error:', err);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// DELETE /:id - delete company and all related data (cascaded by FK)
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.select().from(companies).where(eq(companies.id, req.params.id)).get();
    if (!existing) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    // Delete in order to respect FK constraints in case cascade doesn't trigger
    db.delete(chatMessages)
      .where(
        sql`conversation_id IN (SELECT id FROM chat_conversations WHERE company_id = ${req.params.id})`
      ).run();
    db.delete(taskSteps)
      .where(
        sql`task_id IN (SELECT id FROM tasks WHERE company_id = ${req.params.id})`
      ).run();
    db.delete(chatConversations).where(eq(chatConversations.companyId, req.params.id)).run();
    db.delete(tasks).where(eq(tasks.companyId, req.params.id)).run();
    db.delete(companyEmployees).where(eq(companyEmployees.companyId, req.params.id)).run();
    db.delete(customAgents).where(eq(customAgents.companyId, req.params.id)).run();
    db.delete(apiKeys).where(eq(apiKeys.companyId, req.params.id)).run();
    db.delete(companies).where(eq(companies.id, req.params.id)).run();

    res.json({ success: true });
  } catch (err) {
    console.error('[companies] delete error:', err);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

// ── Custom Departments ──────────────────────────────────────────────────────
// GET /:id/depts - get custom departments
router.get('/:id/depts', (req: Request, res: Response) => {
  try {
    const company = db.select().from(companies).where(eq(companies.id, req.params.id)).get();
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    const settings = (company.settings as Record<string, unknown>) || {};
    const customDepts = (settings.customDepts as Array<{ name: string; color: string }>) || [];
    res.json(customDepts);
  } catch (err) {
    console.error('[companies] get depts error:', err);
    res.status(500).json({ error: 'Failed to get departments' });
  }
});

// POST /:id/depts - add a custom department
router.post('/:id/depts', (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Department name is required' });
      return;
    }

    const company = db.select().from(companies).where(eq(companies.id, req.params.id)).get();
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const settings = (company.settings as Record<string, unknown>) || {};
    const customDepts = (settings.customDepts as Array<{ name: string; color: string }>) || [];
    
    // Check for duplicate
    if (customDepts.some(d => d.name === name.trim())) {
      res.status(409).json({ error: 'Department already exists' });
      return;
    }

    customDepts.push({ name: name.trim(), color: color || '#6366f1' });
    settings.customDepts = customDepts;

    db.update(companies)
      .set({ settings })
      .where(eq(companies.id, req.params.id))
      .run();

    res.status(201).json({ name: name.trim(), color: color || '#6366f1' });
  } catch (err) {
    console.error('[companies] add dept error:', err);
    res.status(500).json({ error: 'Failed to add department' });
  }
});

// DELETE /:id/depts/:deptName - remove a custom department
router.delete('/:id/depts/:deptName', (req: Request, res: Response) => {
  try {
    const company = db.select().from(companies).where(eq(companies.id, req.params.id)).get();
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const settings = (company.settings as Record<string, unknown>) || {};
    const customDepts = (settings.customDepts as Array<{ name: string; color: string }>) || [];
    const deptName = decodeURIComponent(req.params.deptName);
    const filtered = customDepts.filter(d => d.name !== deptName);

    if (filtered.length === customDepts.length) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }

    settings.customDepts = filtered;
    db.update(companies)
      .set({ settings })
      .where(eq(companies.id, req.params.id))
      .run();

    res.json({ success: true });
  } catch (err) {
    console.error('[companies] delete dept error:', err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

export default router;
