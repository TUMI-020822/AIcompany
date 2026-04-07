// ── Skills Executor ──────────────────────────────────────────────────────────
// Built-in lightweight capabilities that agents can use.

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { mcpManager } from '../mcp/manager.js';

const execFileAsync = promisify(execFile);

export interface SkillParams {
  [key: string]: unknown;
}

export interface SkillResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters?: Record<string, { type: string; description: string; required?: boolean }>;
}

// Scoped project root for file operations
const PROJECT_ROOT = path.resolve('/workspace');

// ── Individual Skill Implementations ────────────────────────────────────────

async function executeWebSearch(params: SkillParams): Promise<SkillResult> {
  const query = String(params.query || '');
  if (!query) {
    return { success: false, output: '', error: 'Missing "query" parameter' };
  }

  // Try Brave Search MCP if running
  const braveServer = mcpManager.getServer('brave-search');
  if (braveServer && braveServer.status === 'running') {
    try {
      const result = await mcpManager.callTool('brave-search', 'web_search', { query });
      const text = result.content?.map((c) => c.text || '').join('\n') || 'No results';
      return { success: true, output: text, metadata: { source: 'brave-search-mcp' } };
    } catch (err) {
      // Fall through to fetch-based search
    }
  }

  // Try Fetch MCP if running
  const fetchServer = mcpManager.getServer('fetch');
  if (fetchServer && fetchServer.status === 'running') {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const result = await mcpManager.callTool('fetch', 'fetch_url', { url });
      const text = result.content?.map((c) => c.text || '').join('\n') || 'No results';
      return { success: true, output: text.slice(0, 4000), metadata: { source: 'fetch-mcp' } };
    } catch {
      // Fall through
    }
  }

  // Fallback: basic HTTP fetch to DuckDuckGo instant answer API
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await response.json() as any;

    const parts: string[] = [];
    if (data.AbstractText) parts.push(`Summary: ${data.AbstractText}`);
    if (data.AbstractSource) parts.push(`Source: ${data.AbstractSource}`);
    if (data.RelatedTopics?.length) {
      parts.push('Related:');
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text) parts.push(`  - ${topic.Text}`);
      }
    }

    const output = parts.length > 0 ? parts.join('\n') : `No instant answer found for "${query}". Try a more specific query.`;
    return { success: true, output, metadata: { source: 'duckduckgo-instant' } };
  } catch (err) {
    return { success: false, output: '', error: `Web search failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function executeCodeExec(params: SkillParams): Promise<SkillResult> {
  const code = String(params.code || '');
  const language = String(params.language || 'javascript');
  const timeoutMs = Number(params.timeout) || 10000;

  if (!code) {
    return { success: false, output: '', error: 'Missing "code" parameter' };
  }

  try {
    let result: { stdout: string; stderr: string };

    if (language === 'python' || language === 'python3') {
      result = await execFileAsync('python3', ['-c', code], {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      });
    } else {
      // Default: Node.js
      result = await execFileAsync('node', ['-e', code], {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      });
    }

    const output = result.stdout || '';
    const stderr = result.stderr || '';
    return {
      success: true,
      output: output + (stderr ? `\n[stderr]: ${stderr}` : ''),
      metadata: { language, executionTime: Date.now() },
    };
  } catch (err: any) {
    const stderr = err.stderr || '';
    const stdout = err.stdout || '';
    return {
      success: false,
      output: stdout,
      error: `Code execution failed: ${err.message}${stderr ? `\n${stderr}` : ''}`,
      metadata: { language, killed: err.killed, signal: err.signal },
    };
  }
}

async function executeFileRW(params: SkillParams): Promise<SkillResult> {
  const action = String(params.action || 'read');
  const filePath = String(params.path || '');

  if (!filePath) {
    return { success: false, output: '', error: 'Missing "path" parameter' };
  }

  // Resolve and validate path is within project root
  const resolved = path.resolve(PROJECT_ROOT, filePath);
  if (!resolved.startsWith(PROJECT_ROOT)) {
    return { success: false, output: '', error: 'Path is outside of allowed project directory' };
  }

  try {
    if (action === 'read') {
      const content = await fs.readFile(resolved, 'utf-8');
      return { success: true, output: content.slice(0, 50000), metadata: { path: resolved, size: content.length } };
    } else if (action === 'write') {
      const content = String(params.content || '');
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, 'utf-8');
      return { success: true, output: `Written ${content.length} bytes to ${resolved}`, metadata: { path: resolved } };
    } else if (action === 'list') {
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      const listing = entries.map((e) => `${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`).join('\n');
      return { success: true, output: listing, metadata: { path: resolved, count: entries.length } };
    } else if (action === 'exists') {
      try {
        await fs.access(resolved);
        return { success: true, output: 'true', metadata: { path: resolved } };
      } catch {
        return { success: true, output: 'false', metadata: { path: resolved } };
      }
    } else {
      return { success: false, output: '', error: `Unknown file action: ${action}. Use read, write, list, or exists.` };
    }
  } catch (err) {
    return { success: false, output: '', error: `File operation failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function executeApiCall(params: SkillParams): Promise<SkillResult> {
  const url = String(params.url || '');
  const method = String(params.method || 'GET').toUpperCase();
  const headers = (params.headers as Record<string, string>) || {};
  const body = params.body !== undefined ? JSON.stringify(params.body) : undefined;
  const timeoutMs = Number(params.timeout) || 15000;

  if (!url) {
    return { success: false, output: '', error: 'Missing "url" parameter' };
  }

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();

    return {
      success: response.ok,
      output: responseText.slice(0, 50000),
      metadata: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      },
    };
  } catch (err) {
    return { success: false, output: '', error: `API call failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function executeDocParse(params: SkillParams): Promise<SkillResult> {
  const filePath = String(params.path || '');
  const content = String(params.content || '');

  if (!filePath && !content) {
    return { success: false, output: '', error: 'Provide either "path" or "content" parameter' };
  }

  try {
    let text = content;
    if (filePath) {
      const resolved = path.resolve(PROJECT_ROOT, filePath);
      if (!resolved.startsWith(PROJECT_ROOT)) {
        return { success: false, output: '', error: 'Path is outside of allowed project directory' };
      }
      text = await fs.readFile(resolved, 'utf-8');
    }

    // Basic text extraction: strip HTML tags, normalize whitespace
    const cleaned = text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract sections based on markdown headers
    const sections: string[] = [];
    const lines = cleaned.split(/\n/);
    let currentSection = '';
    for (const line of lines) {
      if (line.startsWith('#')) {
        if (currentSection) sections.push(currentSection.trim());
        currentSection = line + '\n';
      } else {
        currentSection += line + '\n';
      }
    }
    if (currentSection) sections.push(currentSection.trim());

    const output = sections.length > 1 ? sections.join('\n\n---\n\n') : cleaned;
    return {
      success: true,
      output: output.slice(0, 50000),
      metadata: { charCount: text.length, sectionCount: sections.length },
    };
  } catch (err) {
    return { success: false, output: '', error: `Document parse failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function executeReasoning(params: SkillParams): SkillResult {
  const task = String(params.task || params.question || '');
  if (!task) {
    return { success: false, output: '', error: 'Missing "task" or "question" parameter' };
  }

  // Return a CoT system prompt prefix that can be prepended to the agent's system prompt
  const cotPrompt = [
    'You are in enhanced reasoning mode. For this task, follow these steps carefully:',
    '',
    '1. UNDERSTAND: Restate the problem in your own words. Identify what is being asked.',
    '2. ANALYZE: Break the problem into smaller sub-problems. Consider edge cases.',
    '3. PLAN: Outline your approach step by step before executing.',
    '4. EXECUTE: Work through each step methodically, showing your work.',
    '5. VERIFY: Check your reasoning for errors. Consider alternative approaches.',
    '6. CONCLUDE: Provide a clear, well-structured final answer.',
    '',
    `Task: ${task}`,
  ].join('\n');

  return {
    success: true,
    output: cotPrompt,
    metadata: { type: 'cot-prompt', taskLength: task.length },
  };
}

function executeSelfOptimize(params: SkillParams): SkillResult {
  // This is a trigger skill; actual optimization is handled by the AutoAgent optimizer
  const agentId = String(params.agentId || '');
  const programMd = String(params.programMd || '');
  const benchTasks = String(params.benchTasks || '');

  return {
    success: true,
    output: JSON.stringify({
      action: 'trigger_optimization',
      agentId,
      programMd,
      benchTasks,
      message: 'Optimization should be triggered via the /api/autoagent/optimize endpoint',
    }),
    metadata: { type: 'optimization-trigger' },
  };
}

// ── Skill Registry & Dispatcher ─────────────────────────────────────────────

const SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web for real-time information',
    category: 'information',
    parameters: { query: { type: 'string', description: 'Search query', required: true } },
  },
  {
    id: 'code-exec',
    name: 'Code Execution',
    description: 'Run code in a sandboxed subprocess (JavaScript or Python)',
    category: 'development',
    parameters: {
      code: { type: 'string', description: 'Code to execute', required: true },
      language: { type: 'string', description: 'Language: javascript or python' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default 10000)' },
    },
  },
  {
    id: 'file-rw',
    name: 'File Read/Write',
    description: 'Scoped file system access within project directory',
    category: 'system',
    parameters: {
      action: { type: 'string', description: 'read, write, list, or exists', required: true },
      path: { type: 'string', description: 'File path relative to project root', required: true },
      content: { type: 'string', description: 'Content for write action' },
    },
  },
  {
    id: 'api-call',
    name: 'API Call',
    description: 'Make HTTP requests to external APIs',
    category: 'information',
    parameters: {
      url: { type: 'string', description: 'Target URL', required: true },
      method: { type: 'string', description: 'HTTP method (GET, POST, etc.)' },
      headers: { type: 'object', description: 'Request headers' },
      body: { type: 'object', description: 'Request body for POST/PUT' },
    },
  },
  {
    id: 'doc-parse',
    name: 'Document Parse',
    description: 'Extract text from documents',
    category: 'data',
    parameters: {
      path: { type: 'string', description: 'Document file path' },
      content: { type: 'string', description: 'Raw document content' },
    },
  },
  {
    id: 'reasoning',
    name: 'Enhanced Reasoning',
    description: 'Chain-of-thought prompting for complex tasks',
    category: 'cognitive',
    parameters: {
      task: { type: 'string', description: 'Task or question to reason about', required: true },
    },
  },
  {
    id: 'self-optimize',
    name: 'Self-Optimize',
    description: 'Trigger AutoAgent prompt optimization',
    category: 'cognitive',
    parameters: {
      agentId: { type: 'string', description: 'Agent to optimize' },
      programMd: { type: 'string', description: 'Current program.md' },
      benchTasks: { type: 'string', description: 'Benchmark tasks' },
    },
  },
];

const SKILL_HANDLERS: Record<string, (params: SkillParams) => Promise<SkillResult> | SkillResult> = {
  'web-search': executeWebSearch,
  'code-exec': executeCodeExec,
  'file-rw': executeFileRW,
  'api-call': executeApiCall,
  'doc-parse': executeDocParse,
  'reasoning': executeReasoning,
  'self-optimize': executeSelfOptimize,
};

export async function executeSkill(skillId: string, params: SkillParams): Promise<SkillResult> {
  const handler = SKILL_HANDLERS[skillId];
  if (!handler) {
    return {
      success: false,
      output: '',
      error: `Skill "${skillId}" is not available. Available skills: ${Object.keys(SKILL_HANDLERS).join(', ')}`,
    };
  }

  try {
    return await handler(params);
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `Skill execution error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function getAvailableSkills(): SkillDefinition[] {
  return [...SKILL_DEFINITIONS];
}

export function getSkillDefinition(skillId: string): SkillDefinition | undefined {
  return SKILL_DEFINITIONS.find((s) => s.id === skillId);
}
