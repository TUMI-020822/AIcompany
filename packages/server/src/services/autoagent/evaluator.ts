// ── AutoAgent Evaluator ──────────────────────────────────────────────────────
// Uses an LLM as a judge to score agent outputs against criteria.

import { createProvider, type ProviderId } from '../llm/registry.js';
import type { ChatMessage } from '../llm/provider.js';

export interface EvaluationResult {
  score: number;       // 0-1
  reasoning: string;   // LLM's explanation of the score
  criteria: string;    // What was evaluated against
}

export interface EvaluationConfig {
  provider: ProviderId;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Evaluate an agent's output for a given task using an LLM-as-judge approach.
 */
export async function evaluateOutput(
  task: string,
  output: string,
  criteria: string,
  evalConfig: EvaluationConfig,
): Promise<EvaluationResult> {
  const provider = createProvider(evalConfig.provider, {
    apiKey: evalConfig.apiKey || '',
    baseUrl: evalConfig.baseUrl,
    model: evalConfig.model,
  });

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        'You are an expert evaluator. Your job is to score an AI agent\'s output on a scale from 0.0 to 1.0.',
        'Be rigorous but fair. Consider:',
        '- Relevance: Does the output address the task?',
        '- Quality: Is it well-structured, detailed, and accurate?',
        '- Completeness: Are all aspects of the task covered?',
        '- Professionalism: Is the tone and format appropriate?',
        '',
        'Respond in exactly this JSON format (no markdown, no extra text):',
        '{"score": <float 0.0-1.0>, "reasoning": "<brief explanation>"}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        '## Task',
        task,
        '',
        '## Evaluation Criteria',
        criteria || 'General quality, relevance, completeness, and professionalism.',
        '',
        '## Agent Output',
        output.slice(0, 8000),
        '',
        'Score this output (0.0 to 1.0) and explain your reasoning.',
      ].join('\n'),
    },
  ];

  try {
    const response = await provider.chat({
      model: evalConfig.model || '',
      messages,
      temperature: 0.1,
      maxTokens: 512,
    });

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*?"score"\s*:\s*([\d.]+)[\s\S]*?"reasoning"\s*:\s*"([^"]*)"[\s\S]*?\}/);
    if (jsonMatch) {
      const score = Math.max(0, Math.min(1, parseFloat(jsonMatch[1])));
      return {
        score,
        reasoning: jsonMatch[2],
        criteria: criteria || 'general quality',
      };
    }

    // Fallback: try to extract any number from the response
    const numberMatch = response.match(/(0\.\d+|1\.0|0|1)/);
    const score = numberMatch ? parseFloat(numberMatch[1]) : 0.5;

    return {
      score: Math.max(0, Math.min(1, score)),
      reasoning: response.slice(0, 500),
      criteria: criteria || 'general quality',
    };
  } catch (err) {
    console.error('[evaluator] Evaluation failed:', err);
    return {
      score: 0,
      reasoning: `Evaluation error: ${err instanceof Error ? err.message : String(err)}`,
      criteria: criteria || 'general quality',
    };
  }
}

/**
 * Evaluate multiple outputs and return the average score.
 */
export async function evaluateBatch(
  taskOutputPairs: Array<{ task: string; output: string }>,
  criteria: string,
  evalConfig: EvaluationConfig,
): Promise<{ scores: EvaluationResult[]; averageScore: number }> {
  const scores: EvaluationResult[] = [];

  for (const pair of taskOutputPairs) {
    const result = await evaluateOutput(pair.task, pair.output, criteria, evalConfig);
    scores.push(result);
  }

  const averageScore = scores.length > 0
    ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
    : 0;

  return { scores, averageScore };
}
