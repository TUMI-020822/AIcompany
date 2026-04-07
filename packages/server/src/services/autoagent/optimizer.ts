// ── AutoAgent Optimizer ──────────────────────────────────────────────────────
// Hill-climbing prompt optimization loop.

import type { Server as SocketIOServer } from 'socket.io';
import { createProvider, type ProviderId } from '../llm/registry.js';
import type { ChatMessage } from '../llm/provider.js';
import { evaluateOutput, type EvaluationConfig } from './evaluator.js';

export interface OptimizationConfig {
  agentId: string;
  agentName: string;
  systemPrompt: string;
  programMd: string;
  benchmarkTasks: string[];
  criteria?: string;
  iterations: number;
  provider: ProviderId;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface OptimizationLogEntry {
  iteration: number;
  action: string;
  oldScore: number;
  newScore: number;
  kept: boolean;
  reasoning: string;
  timestamp: number;
}

export interface OptimizationResult {
  finalScore: number;
  initialScore: number;
  bestScore: number;
  updatedProgramMd: string;
  updatedSystemPrompt: string;
  log: OptimizationLogEntry[];
  totalIterations: number;
}

// Track running optimizations
const runningOptimizations = new Map<string, { status: string; result?: OptimizationResult }>();

/**
 * Run the agent on a task with a given system prompt and program.md.
 */
async function runAgentOnTask(
  task: string,
  systemPrompt: string,
  programMd: string,
  config: OptimizationConfig,
): Promise<string> {
  const provider = createProvider(config.provider, {
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl,
    model: config.model,
  });

  const fullSystemPrompt = programMd
    ? `${systemPrompt}\n\n---\n\n## Optimization Instructions\n${programMd}`
    : systemPrompt;

  const messages: ChatMessage[] = [
    { role: 'system', content: fullSystemPrompt },
    { role: 'user', content: task },
  ];

  return provider.chat({
    model: config.model || '',
    messages,
    temperature: 0.7,
    maxTokens: 2048,
  });
}

/**
 * Ask an LLM to propose modifications to the program.md based on evaluation feedback.
 */
async function proposeModification(
  currentProgramMd: string,
  currentSystemPrompt: string,
  evaluationFeedback: string,
  currentScore: number,
  iteration: number,
  config: OptimizationConfig,
): Promise<{ modifiedProgramMd: string; modifiedSystemPrompt: string; action: string }> {
  const provider = createProvider(config.provider, {
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl,
    model: config.model,
  });

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        'You are a meta-optimization agent. Your job is to improve an AI agent\'s configuration.',
        'Given the current program.md (optimization instructions), system prompt, evaluation feedback,',
        'and current score, propose specific modifications to improve performance.',
        '',
        'Respond in exactly this JSON format (no markdown wrapping, no extra text):',
        '{',
        '  "action": "<brief description of what you changed>",',
        '  "modifiedProgramMd": "<the complete updated program.md>",',
        '  "modifiedSystemPrompt": "<the complete updated system prompt>"',
        '}',
        '',
        'Focus on one or two targeted improvements per iteration. Common strategies:',
        '- Sharpen role definition and expertise areas',
        '- Add specific output format constraints',
        '- Include chain-of-thought reasoning steps',
        '- Add domain-specific knowledge or examples',
        '- Adjust tone and communication style',
        '- Add quality checklist items',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `## Iteration ${iteration}`,
        `## Current Score: ${currentScore.toFixed(3)}`,
        '',
        '## Current Program.md',
        currentProgramMd || '(empty)',
        '',
        '## Current System Prompt',
        currentSystemPrompt.slice(0, 2000),
        '',
        '## Evaluation Feedback',
        evaluationFeedback,
        '',
        'Propose modifications to improve the score. Keep changes targeted and incremental.',
      ].join('\n'),
    },
  ];

  try {
    const response = await provider.chat({
      model: config.model || '',
      messages,
      temperature: 0.8,
      maxTokens: 2048,
    });

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*"action"[\s\S]*"modifiedProgramMd"[\s\S]*"modifiedSystemPrompt"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || 'Unknown modification',
        modifiedProgramMd: parsed.modifiedProgramMd || currentProgramMd,
        modifiedSystemPrompt: parsed.modifiedSystemPrompt || currentSystemPrompt,
      };
    }

    // Fallback: if we can't parse, make a minor modification
    return {
      action: 'Minor prompt refinement (could not parse LLM suggestion)',
      modifiedProgramMd: currentProgramMd + `\n\n## Iteration ${iteration} Note\nFocus on improving quality and specificity.`,
      modifiedSystemPrompt: currentSystemPrompt,
    };
  } catch (err) {
    console.error('[optimizer] Proposal generation failed:', err);
    return {
      action: `Proposal failed: ${err instanceof Error ? err.message : String(err)}`,
      modifiedProgramMd: currentProgramMd,
      modifiedSystemPrompt: currentSystemPrompt,
    };
  }
}

function emitOptimizationProgress(
  io: SocketIOServer | null,
  agentId: string,
  data: Record<string, unknown>,
): void {
  if (io) {
    io.emit('autoagent:progress', { agentId, ...data });
  }
}

/**
 * Run the full hill-climbing optimization loop.
 */
export async function runOptimization(
  config: OptimizationConfig,
  io: SocketIOServer | null = null,
): Promise<OptimizationResult> {
  const log: OptimizationLogEntry[] = [];
  let currentProgramMd = config.programMd;
  let currentSystemPrompt = config.systemPrompt;
  let bestScore = 0;
  let initialScore = 0;
  const iterations = Math.min(config.iterations || 3, 10); // Cap at 10

  const evalConfig: EvaluationConfig = {
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  };

  runningOptimizations.set(config.agentId, { status: 'running' });

  emitOptimizationProgress(io, config.agentId, {
    type: 'start',
    message: `Starting optimization for ${config.agentName} (${iterations} iterations)`,
    iteration: 0,
    totalIterations: iterations,
  });

  // ── Baseline evaluation ────────────────────────────────────────────────
  emitOptimizationProgress(io, config.agentId, {
    type: 'log',
    message: 'Running baseline evaluation...',
    iteration: 0,
  });

  let currentScore = 0;
  const baselineOutputs: string[] = [];

  for (const task of config.benchmarkTasks) {
    try {
      const output = await runAgentOnTask(task, currentSystemPrompt, currentProgramMd, config);
      baselineOutputs.push(output);

      const evalResult = await evaluateOutput(task, output, config.criteria || '', evalConfig);
      currentScore += evalResult.score;
    } catch (err) {
      console.error('[optimizer] Baseline task failed:', err);
      currentScore += 0;
    }
  }

  currentScore = config.benchmarkTasks.length > 0 ? currentScore / config.benchmarkTasks.length : 0;
  initialScore = currentScore;
  bestScore = currentScore;

  emitOptimizationProgress(io, config.agentId, {
    type: 'baseline',
    message: `Baseline score: ${currentScore.toFixed(3)}`,
    score: currentScore,
    iteration: 0,
  });

  // ── Optimization iterations ────────────────────────────────────────────
  for (let iter = 1; iter <= iterations; iter++) {
    emitOptimizationProgress(io, config.agentId, {
      type: 'iteration_start',
      message: `Iteration ${iter}/${iterations}: Proposing modifications...`,
      iteration: iter,
      currentScore,
    });

    // Gather feedback from last evaluation
    const feedback = `Current average score: ${currentScore.toFixed(3)}. Areas to improve based on benchmark tasks.`;

    // Propose modifications
    const proposal = await proposeModification(
      currentProgramMd,
      currentSystemPrompt,
      feedback,
      currentScore,
      iter,
      config,
    );

    emitOptimizationProgress(io, config.agentId, {
      type: 'log',
      message: `Proposed: ${proposal.action}`,
      iteration: iter,
    });

    // Run with modified prompts and evaluate
    let newScore = 0;
    for (const task of config.benchmarkTasks) {
      try {
        const output = await runAgentOnTask(task, proposal.modifiedSystemPrompt, proposal.modifiedProgramMd, config);
        const evalResult = await evaluateOutput(task, output, config.criteria || '', evalConfig);
        newScore += evalResult.score;
      } catch (err) {
        console.error(`[optimizer] Iteration ${iter} task failed:`, err);
        newScore += 0;
      }
    }

    newScore = config.benchmarkTasks.length > 0 ? newScore / config.benchmarkTasks.length : 0;

    const kept = newScore >= currentScore;
    const entry: OptimizationLogEntry = {
      iteration: iter,
      action: proposal.action,
      oldScore: currentScore,
      newScore,
      kept,
      reasoning: kept
        ? `Score improved from ${currentScore.toFixed(3)} to ${newScore.toFixed(3)}`
        : `Score dropped from ${currentScore.toFixed(3)} to ${newScore.toFixed(3)}, reverting`,
      timestamp: Date.now(),
    };
    log.push(entry);

    if (kept) {
      currentProgramMd = proposal.modifiedProgramMd;
      currentSystemPrompt = proposal.modifiedSystemPrompt;
      currentScore = newScore;
      if (newScore > bestScore) bestScore = newScore;
    }

    emitOptimizationProgress(io, config.agentId, {
      type: 'iteration_result',
      message: `Iteration ${iter}: ${proposal.action} -> ${newScore.toFixed(3)} (${kept ? 'KEPT' : 'REVERTED'})`,
      iteration: iter,
      oldScore: entry.oldScore,
      newScore: entry.newScore,
      kept,
      currentScore,
      bestScore,
    });
  }

  const result: OptimizationResult = {
    finalScore: currentScore,
    initialScore,
    bestScore,
    updatedProgramMd: currentProgramMd,
    updatedSystemPrompt: currentSystemPrompt,
    log,
    totalIterations: iterations,
  };

  runningOptimizations.set(config.agentId, { status: 'completed', result });

  emitOptimizationProgress(io, config.agentId, {
    type: 'complete',
    message: `Optimization complete! Score: ${initialScore.toFixed(3)} -> ${currentScore.toFixed(3)} (best: ${bestScore.toFixed(3)})`,
    result: {
      finalScore: result.finalScore,
      initialScore: result.initialScore,
      bestScore: result.bestScore,
      totalIterations: result.totalIterations,
    },
  });

  return result;
}

export function getOptimizationStatus(agentId: string): { status: string; result?: OptimizationResult } | null {
  return runningOptimizations.get(agentId) || null;
}
