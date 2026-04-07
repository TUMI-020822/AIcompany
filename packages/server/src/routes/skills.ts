// ── Skills REST Routes ───────────────────────────────────────────────────────
import { Router, type Request, type Response } from 'express';
import { getAvailableSkills, executeSkill } from '../services/skills/executor.js';

const router = Router();

// GET /skills - List all available skills
router.get('/', (_req: Request, res: Response) => {
  try {
    const skills = getAvailableSkills();
    res.json(skills);
  } catch (err) {
    console.error('[skills-routes] list error:', err);
    res.status(500).json({ error: 'Failed to list skills' });
  }
});

// POST /skills/:id/execute - Execute a skill
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const params = req.body || {};

    const result = await executeSkill(id, params);
    res.json(result);
  } catch (err) {
    console.error(`[skills-routes] execute ${req.params.id} error:`, err);
    res.status(500).json({
      success: false,
      output: '',
      error: `Skill execution failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

export default router;
