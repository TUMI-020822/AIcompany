// ── MCP REST Routes ──────────────────────────────────────────────────────────
import { Router, type Request, type Response } from 'express';
import { mcpManager } from '../services/mcp/manager.js';
import { getAllMCPServerConfigs, getMCPServerConfig } from '../services/mcp/registry.js';

const router = Router();

// GET /mcp/servers - List all available MCP server configurations
router.get('/servers', (_req: Request, res: Response) => {
  try {
    const configs = getAllMCPServerConfigs();
    const running = mcpManager.getRunningServers();
    const runningIds = new Set(running.map((s) => s.id));

    const result = configs.map((cfg) => {
      const srv = mcpManager.getServer(cfg.id);
      return {
        ...cfg,
        status: srv ? srv.status : 'stopped',
        connected: srv?.status === 'running',
        discoveredTools: srv?.tools?.map((t) => ({ name: t.name, description: t.description })) || [],
        error: srv?.error || null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('[mcp-routes] list servers error:', err);
    res.status(500).json({ error: 'Failed to list MCP servers' });
  }
});

// GET /mcp/status - Get status of all servers
router.get('/status', (_req: Request, res: Response) => {
  try {
    const running = mcpManager.getRunningServers();
    const result = running.map((srv) => ({
      id: srv.id,
      name: srv.config.name,
      status: srv.status,
      toolCount: srv.tools.length,
      tools: srv.tools.map((t) => t.name),
      error: srv.error || null,
      uptime: Date.now() - srv.startedAt,
    }));
    res.json({ servers: result, totalRunning: running.filter((s) => s.status === 'running').length });
  } catch (err) {
    console.error('[mcp-routes] status error:', err);
    res.status(500).json({ error: 'Failed to get MCP status' });
  }
});

// POST /mcp/servers/:id/start - Start an MCP server
router.post('/servers/:id/start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const envOverrides = req.body?.env as Record<string, string> | undefined;

    const config = getMCPServerConfig(id);
    if (!config) {
      res.status(404).json({ error: `MCP server "${id}" not found in registry` });
      return;
    }

    const server = await mcpManager.startServer(id, envOverrides);

    res.json({
      id: server.id,
      name: server.config.name,
      status: server.status,
      tools: server.tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    });
  } catch (err) {
    console.error(`[mcp-routes] start server ${req.params.id} error:`, err);
    res.status(500).json({
      error: `Failed to start MCP server: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

// POST /mcp/servers/:id/stop - Stop an MCP server
router.post('/servers/:id/stop', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await mcpManager.stopServer(id);
    res.json({ id, status: 'stopped' });
  } catch (err) {
    console.error(`[mcp-routes] stop server ${req.params.id} error:`, err);
    res.status(500).json({ error: 'Failed to stop MCP server' });
  }
});

// GET /mcp/servers/:id/tools - List tools from a running server
router.get('/servers/:id/tools', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const server = mcpManager.getServer(id);

    if (!server) {
      res.status(404).json({ error: `MCP server "${id}" is not running` });
      return;
    }

    res.json({
      serverId: id,
      status: server.status,
      tools: server.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  } catch (err) {
    console.error(`[mcp-routes] list tools ${req.params.id} error:`, err);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

// POST /mcp/servers/:id/tools/:toolName/call - Call a tool on a running server
router.post('/servers/:id/tools/:toolName/call', async (req: Request, res: Response) => {
  try {
    const { id, toolName } = req.params;
    const args = req.body?.args || {};

    const result = await mcpManager.callTool(id, toolName, args);

    res.json({
      serverId: id,
      toolName,
      result,
    });
  } catch (err) {
    console.error(`[mcp-routes] call tool ${req.params.id}/${req.params.toolName} error:`, err);
    res.status(500).json({
      error: `Tool call failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

export default router;
