// Migration: Add enhanced agent config fields
// Run: npx tsx src/db/migrate-add-agent-fields.ts

import { db } from './index.js';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('[migration] Adding enhanced fields to agents_catalog...');

  const fields = [
    { col: 'model', type: 'TEXT NOT NULL DEFAULT', default: "'deepseek-chat'" },
    { col: 'skills', type: 'TEXT NOT NULL DEFAULT', default: "'[]'" },
    { col: 'mcp_tools', type: 'TEXT NOT NULL DEFAULT', default: "'[]'" },
    { col: 'self_improve', type: 'INTEGER NOT NULL DEFAULT', default: '1' },
    { col: 'program_md', type: 'TEXT NOT NULL DEFAULT', default: "''" },
    { col: 'benchmark', type: 'TEXT NOT NULL DEFAULT', default: "''" },
  ];

  for (const f of fields) {
    try {
      db.run(sql`ALTER TABLE agents_catalog ADD COLUMN ${sql.raw(f.col)} ${sql.raw(f.type)} ${sql.raw(f.default)}`);
      console.log(`  + ${f.col}`);
    } catch (err: any) {
      if (err.message?.includes('duplicate column')) {
        console.log(`  ~ ${f.col} (already exists)`);
      } else {
        console.error(`  ! ${f.col}: ${err.message}`);
      }
    }
  }

  console.log('[migration] Done.');
}

migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
