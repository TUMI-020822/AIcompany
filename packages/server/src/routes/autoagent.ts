// ── AutoAgent REST Routes ────────────────────────────────────────────────────
import { Router, type Request, type Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { runOptimization, getOptimizationStatus, type OptimizationConfig } from '../services/autoagent/optimizer.js';
import type { ProviderId } from '../services/llm/registry.js';

export function createAutoAgentRouter(io: SocketIOServer): Router {
  const router = Router();

  // POST /autoagent/optimize - Start an optimization run
  router.post('/optimize', async (req: Request, res: Response) => {
    try {
      const {
        agentId,
        agentName,
        systemPrompt,
        programMd,
        benchmarkTasks,
        criteria,
        iterations,
        provider,
        model,
        apiKey,
        baseUrl,
      } = req.body;

      if (!agentId) {
        res.status(400).json({ error: 'agentId is required' });
        return;
      }

      if (!provider) {
        res.status(400).json({ error: 'provider is required' });
        return;
      }

      // Parse benchmark tasks (string with newlines -> array)
      let tasks: string[] = [];
      if (Array.isArray(benchmarkTasks)) {
        tasks = benchmarkTasks;
      } else if (typeof benchmarkTasks === 'string') {
        tasks = benchmarkTasks
          .split('\n')
          .map((t: string) => t.trim())
          .filter((t: string) => t.length > 0);
      }

      if (tasks.length === 0) {
        tasks = [`Perform a general task related to ${agentName || agentId}'s expertise and provide a detailed response.`];
      }

      const config: OptimizationConfig = {
        agentId,
        agentName: agentName || agentId,
        systemPrompt: systemPrompt || '',
        programMd: programMd || '',
        benchmarkTasks: tasks,
        criteria: criteria || '',
        iterations: iterations || 3,
        provider: provider as ProviderId,
        model,
        apiKey,
        baseUrl,
      };

      // Start optimization in the background (non-blocking)
      res.json({
        status: 'started',
        agentId,
        iterations: config.iterations,
        benchmarkTaskCount: tasks.length,
        message: 'Optimization started. Listen to Socket.IO autoagent:progress events for real-time updates.',
      });

      // Run asynchronously after responding
      runOptimization(config, io).catch((err) => {
        console.error(`[autoagent-routes] Optimization error for ${agentId}:`, err);
        io.emit('autoagent:progress', {
          agentId,
          type: 'error',
          message: `Optimization failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      });
    } catch (err) {
      console.error('[autoagent-routes] optimize error:', err);
      res.status(500).json({ error: `Failed to start optimization: ${err instanceof Error ? err.message : String(err)}` });
    }
  });

  // GET /autoagent/status/:agentId - Get optimization status
  router.get('/status/:agentId', (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const status = getOptimizationStatus(agentId);

      if (!status) {
        res.json({ agentId, status: 'idle', message: 'No optimization has been run for this agent' });
        return;
      }

      res.json({ agentId, ...status });
    } catch (err) {
      console.error('[autoagent-routes] status error:', err);
      res.status(500).json({ error: 'Failed to get optimization status' });
    }
  });

  return router;
}
