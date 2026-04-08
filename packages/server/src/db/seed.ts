import { db } from './index.js';
import { agentsCatalog } from './schema.js';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load all agent configs from JSON files
function loadAgents() {
  const configs = [];
  for (let i = 1; i <= 6; i++) {
    const filePath = join(__dirname, `agents-config-p${i}.json`);
    try {
      const content = readFileSync(filePath, 'utf-8');
      const agents = JSON.parse(content);
      configs.push(...agents);
    } catch (e) {
      // Skip missing files
    }
  }
  return configs;
}

const AGENTS_DB = loadAgents();

export async function seedAgentsCatalog(): Promise<void> {
  const existing = db.select().from(agentsCatalog).all();

  if (existing.length >= AGENTS_DB.length) {
    console.log(`[seed] agents_catalog already has ${existing.length} agents, skipping.`);
    return;
  }

  console.log(`[seed] Seeding ${AGENTS_DB.length} agents from JSON configs...`);

  for (const agent of AGENTS_DB) {
    const exists = db.select().from(agentsCatalog).where(eq(agentsCatalog.id, agent.id)).get();
    if (!exists) {
      db.insert(agentsCatalog).values({
        id: agent.id,
        name: agent.name,
        dept: agent.dept,
        description: agent.desc,
        tags: agent.tags,
        role: agent.role,
        model: agent.model || 'deepseek-chat',
        skills: agent.skills || [],
        mcpTools: agent.mcpTools || [],
        selfImprove: agent.selfImprove ? 1 : 0,
        programMd: agent.programMd || '',
        benchmark: agent.benchmark || '',
        systemPrompt: agent.systemPrompt,
      }).run();
      console.log(`  + ${agent.id}: ${agent.name}`);
    }
  }

  console.log(`[seed] Done. Total agents: ${AGENTS_DB.length}`);
}

// Allow running directly: npx tsx src/db/seed.ts
const isDirectRun = process.argv[1]?.includes('seed');
if (isDirectRun) {
  seedAgentsCatalog().then(() => {
    console.log('[seed] Complete.');
    process.exit(0);
  });
}
