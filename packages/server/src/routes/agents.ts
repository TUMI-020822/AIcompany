import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { agentsCatalog, customAgents, companyEmployees, companies } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Default agent configuration applied when hiring
const AGENT_DEFAULTS: Record<string, Record<string, unknown>> = {
  // Product dept
  pm:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.7, maxTokens: 4096 },
  po:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.7, maxTokens: 4096 },
  ba:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.6, maxTokens: 4096 },
  // Engineering dept
  arch: { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.5, maxTokens: 8192 },
  be:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.4, maxTokens: 8192 },
  fe:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.4, maxTokens: 8192 },
  sre:  { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.4, maxTokens: 4096 },
  sec:  { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.4, maxTokens: 4096 },
  cr:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.3, maxTokens: 8192 },
  qa:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.4, maxTokens: 4096 },
  dba:  { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.3, maxTokens: 4096 },
  // Design dept
  uxr:  { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.7, maxTokens: 4096 },
  uid:  { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.8, maxTokens: 4096 },
  uxa:  { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.6, maxTokens: 4096 },
  // Data dept
  da:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.5, maxTokens: 4096 },
  de:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.4, maxTokens: 4096 },
  ds:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.5, maxTokens: 4096 },
  // Marketing dept
  seo:  { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.7, maxTokens: 4096 },
  gm:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.7, maxTokens: 4096 },
  cc:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.9, maxTokens: 4096 },
  sm:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.8, maxTokens: 4096 },
  xhs:  { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.8, maxTokens: 4096 },
  // Operations dept
  pjm:  { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.5, maxTokens: 4096 },
  ma:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.4, maxTokens: 4096 },
  es:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.5, maxTokens: 4096 },
  // Strategy dept
  tr:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.6, maxTokens: 4096 },
  fp:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.4, maxTokens: 4096 },
  st:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.6, maxTokens: 4096 },
  // Legal dept
  le:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.3, maxTokens: 4096 },
  lc:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.3, maxTokens: 4096 },
  // HR dept
  hr:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.6, maxTokens: 4096 },
  psy:  { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.7, maxTokens: 4096 },
  // Creative dept
  nar:  { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.9, maxTokens: 4096 },
  nd:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.9, maxTokens: 4096 },
  vs:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.8, maxTokens: 4096 },
};

const DEFAULT_AGENT_CONFIG: Record<string, unknown> = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 4096,
};

// GET /catalog - list all available agents (catalog + custom for optional companyId)
router.get('/catalog', (req: Request, res: Response) => {
  try {
    const companyId = req.query.companyId as string | undefined;
    const catalogAgents = db.select().from(agentsCatalog).all();
    let custom: typeof catalogAgents = [];

    if (companyId) {
      const rawCustom = db.select().from(customAgents).where(eq(customAgents.companyId, companyId)).all();
      custom = rawCustom.map((a) => ({
        id: a.id,
        name: a.name,
        dept: a.dept,
        description: a.description,
        tags: a.tags,
        role: 'custom',
        systemPrompt: a.systemPrompt,
      }));
    }

    res.json([...catalogAgents, ...custom]);
  } catch (err) {
    console.error('[agents] catalog error:', err);
    res.status(500).json({ error: 'Failed to list agents catalog' });
  }
});

// POST /companies/:companyId/hire - hire an agent
router.post('/companies/:companyId/hire', (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { agentId, config: agentConfig } = req.body;

    if (!agentId) {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }

    // Verify company exists
    const company = db.select().from(companies).where(eq(companies.id, companyId)).get();
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    // Verify agent exists in catalog or custom agents
    const catalogAgent = db.select().from(agentsCatalog).where(eq(agentsCatalog.id, agentId)).get();
    const customAgent = db.select().from(customAgents)
      .where(and(eq(customAgents.id, agentId), eq(customAgents.companyId, companyId))).get();

    if (!catalogAgent && !customAgent) {
      res.status(404).json({ error: 'Agent not found in catalog' });
      return;
    }

    // Check if already hired
    const existing = db.select().from(companyEmployees)
      .where(and(eq(companyEmployees.companyId, companyId), eq(companyEmployees.agentId, agentId))).get();

    if (existing) {
      res.status(409).json({ error: 'Agent already hired' });
      return;
    }

    const finalConfig = agentConfig || AGENT_DEFAULTS[agentId] || DEFAULT_AGENT_CONFIG;

    db.insert(companyEmployees).values({
      companyId,
      agentId,
      config: finalConfig,
      hiredAt: new Date().toISOString(),
    }).run();

    const hired = db.select().from(companyEmployees)
      .where(and(eq(companyEmployees.companyId, companyId), eq(companyEmployees.agentId, agentId))).get();

    res.status(201).json(hired);
  } catch (err) {
    console.error('[agents] hire error:', err);
    res.status(500).json({ error: 'Failed to hire agent' });
  }
});

// DELETE /companies/:companyId/agents/:agentId - fire an agent
router.delete('/companies/:companyId/agents/:agentId', (req: Request, res: Response) => {
  try {
    const { companyId, agentId } = req.params;

    const existing = db.select().from(companyEmployees)
      .where(and(eq(companyEmployees.companyId, companyId), eq(companyEmployees.agentId, agentId))).get();

    if (!existing) {
      res.status(404).json({ error: 'Agent not hired in this company' });
      return;
    }

    db.delete(companyEmployees)
      .where(and(eq(companyEmployees.companyId, companyId), eq(companyEmployees.agentId, agentId)))
      .run();

    res.json({ success: true });
  } catch (err) {
    console.error('[agents] fire error:', err);
    res.status(500).json({ error: 'Failed to fire agent' });
  }
});

// PUT /companies/:companyId/agents/:agentId/config - update agent config
router.put('/companies/:companyId/agents/:agentId/config', (req: Request, res: Response) => {
  try {
    const { companyId, agentId } = req.params;
    const newConfig = req.body;

    const existing = db.select().from(companyEmployees)
      .where(and(eq(companyEmployees.companyId, companyId), eq(companyEmployees.agentId, agentId))).get();

    if (!existing) {
      res.status(404).json({ error: 'Agent not hired in this company' });
      return;
    }

    const mergedConfig = { ...(existing.config as Record<string, unknown>), ...newConfig };

    db.update(companyEmployees)
      .set({ config: mergedConfig })
      .where(and(eq(companyEmployees.companyId, companyId), eq(companyEmployees.agentId, agentId)))
      .run();

    const updated = db.select().from(companyEmployees)
      .where(and(eq(companyEmployees.companyId, companyId), eq(companyEmployees.agentId, agentId))).get();

    res.json(updated);
  } catch (err) {
    console.error('[agents] update config error:', err);
    res.status(500).json({ error: 'Failed to update agent config' });
  }
});

// GET /companies/:companyId/agents - list hired agents with configs
router.get('/companies/:companyId/agents', (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    const employees = db.select().from(companyEmployees)
      .where(eq(companyEmployees.companyId, companyId)).all();

    // Enrich with agent details from catalog / custom
    const enriched = employees.map((emp) => {
      const catalogAgent = db.select().from(agentsCatalog).where(eq(agentsCatalog.id, emp.agentId)).get();
      const custom = catalogAgent
        ? null
        : db.select().from(customAgents).where(eq(customAgents.id, emp.agentId)).get();

      const agent = catalogAgent || custom;

      return {
        ...emp,
        agent: agent
          ? { id: agent.id, name: agent.name, dept: agent.dept, description: agent.description, tags: agent.tags }
          : null,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('[agents] list hired error:', err);
    res.status(500).json({ error: 'Failed to list hired agents' });
  }
});

// POST /companies/:companyId/custom-agents - create a custom agent
router.post('/companies/:companyId/custom-agents', (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { name, dept, description, tags, systemPrompt } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Agent name is required' });
      return;
    }

    // Verify company exists
    const company = db.select().from(companies).where(eq(companies.id, companyId)).get();
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const id = nanoid();
    const now = new Date().toISOString();
    const parsedTags = Array.isArray(tags) ? tags : (tags ? [tags] : []);

    db.insert(customAgents).values({
      id,
      companyId,
      name: name.trim(),
      dept: dept?.trim() || '',
      description: description?.trim() || '',
      tags: parsedTags,
      systemPrompt: systemPrompt?.trim() || '',
      createdAt: now,
    }).run();

    const agent = db.select().from(customAgents).where(eq(customAgents.id, id)).get();
    res.status(201).json({
      id: agent!.id,
      name: agent!.name,
      dept: agent!.dept,
      description: agent!.description,
      tags: agent!.tags,
      role: 'custom',
      systemPrompt: agent!.systemPrompt,
    });
  } catch (err) {
    console.error('[agents] create custom agent error:', err);
    res.status(500).json({ error: 'Failed to create custom agent' });
  }
});

// DELETE /companies/:companyId/custom-agents/:agentId - delete a custom agent
router.delete('/companies/:companyId/custom-agents/:agentId', (req: Request, res: Response) => {
  try {
    const { companyId, agentId } = req.params;

    const existing = db.select().from(customAgents)
      .where(and(eq(customAgents.id, agentId), eq(customAgents.companyId, companyId))).get();

    if (!existing) {
      res.status(404).json({ error: 'Custom agent not found' });
      return;
    }

    db.delete(customAgents)
      .where(and(eq(customAgents.id, agentId), eq(customAgents.companyId, companyId)))
      .run();

    res.json({ success: true });
  } catch (err) {
    console.error('[agents] delete custom agent error:', err);
    res.status(500).json({ error: 'Failed to delete custom agent' });
  }
});

export default router;
