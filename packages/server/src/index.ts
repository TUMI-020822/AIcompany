import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

// Import DB (auto-initializes tables on import)
import './db/index.js';
import { seedAgentsCatalog } from './db/seed.js';
import { AutoBackupScheduler, checkDatabaseHealth } from './db/backup.js';

// Import routes
import companiesRouter from './routes/companies.js';
import agentsRouter from './routes/agents.js';
import chatRouter from './routes/chat.js';
import { createTasksRouter } from './routes/tasks.js';
import mcpRouter from './routes/mcp.js';
import skillsRouter from './routes/skills.js';
import { createAutoAgentRouter } from './routes/autoagent.js';
import systemRouter from './routes/system.js';

// Import middleware
import { errorHandler, requestLogger, defaultRateLimiter, timeoutMiddleware } from './middleware/index.js';

// Import performance monitoring
import { resourceMonitor, taskMetricsCollector } from './utils/performance.js';

// Import chat service for socket handlers
import { sendMessage } from './services/chat.js';

// Import orchestrator for socket handlers
import { launchTask } from './services/orchestrator/index.js';

// Import MCP manager for socket handlers
import { mcpManager } from './services/mcp/manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);
app.use(defaultRateLimiter.middleware);
app.use(timeoutMiddleware(60000)); // 60s timeout for API requests

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/companies', companiesRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/tasks', createTasksRouter(io));
app.use('/api/mcp', mcpRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/autoagent', createAutoAgentRouter(io));
app.use('/api/system', systemRouter);

// Health check (enhanced)
app.get('/api/health', async (_req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const memUsage = process.memoryUsage();

    res.json({
      status: dbHealth.status === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Health check failed',
    });
  }
});

// ── Static file serving (production) ────────────────────────────────────────
const webDistPath = path.resolve(__dirname, '../../web/dist');
app.use(express.static(webDistPath));

// SPA fallback: serve index.html for any non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'API endpoint not found' });
    return;
  }
  res.sendFile(path.join(webDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).json({ error: 'Web app not built yet. Run: npm run build -w packages/web' });
    }
  });
});

// ── Socket.IO Event Handlers ────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);

  // Join a conversation room
  socket.on('join_conversation', (conversationId: string) => {
    socket.join(`conv:${conversationId}`);
    console.log(`[socket] ${socket.id} joined conversation ${conversationId}`);
  });

  // Leave a conversation room
  socket.on('leave_conversation', (conversationId: string) => {
    socket.leave(`conv:${conversationId}`);
    console.log(`[socket] ${socket.id} left conversation ${conversationId}`);
  });

  // Send a chat message with streaming response
  socket.on('send_message', async (data: { conversationId: string; content: string; senderId?: string }) => {
    const { conversationId, content, senderId } = data;

    if (!conversationId || !content) {
      socket.emit('error', { message: 'conversationId and content are required' });
      return;
    }

    try {
      // Notify that the agent is typing
      io.to(`conv:${conversationId}`).emit('agent_typing', { conversationId, typing: true });

      const result = await sendMessage({
        conversationId,
        content,
        senderId,
        onToken: (token: string) => {
          io.to(`conv:${conversationId}`).emit('message_token', {
            conversationId,
            token,
            messageId: '', // Will be set after completion
          });
        },
      });

      // Emit the complete messages
      io.to(`conv:${conversationId}`).emit('message_complete', {
        conversationId,
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
      });

      // Notify that the agent stopped typing
      io.to(`conv:${conversationId}`).emit('agent_typing', { conversationId, typing: false });
    } catch (err) {
      console.error('[socket] send_message error:', err);
      io.to(`conv:${conversationId}`).emit('agent_typing', { conversationId, typing: false });
      socket.emit('error', {
        message: err instanceof Error ? err.message : 'Failed to send message',
      });
    }
  });

  // ── Task Orchestration Socket Events ──────────────────────────────────────

  // Subscribe to task updates
  socket.on('task:subscribe', (taskId: string) => {
    socket.join(`task:${taskId}`);
    console.log(`[socket] ${socket.id} subscribed to task ${taskId}`);
  });

  // Unsubscribe from task updates
  socket.on('task:unsubscribe', (taskId: string) => {
    socket.leave(`task:${taskId}`);
    console.log(`[socket] ${socket.id} unsubscribed from task ${taskId}`);
  });

  // Launch a task via Socket.IO
  socket.on('task:launch', async (data: { companyId: string; name: string; description?: string }) => {
    const { companyId, name, description } = data;

    if (!companyId || !name) {
      socket.emit('error', { message: 'companyId and name are required' });
      return;
    }

    try {
      // Auto-subscribe the launching client to this task's updates
      const result = await launchTask(companyId, name, description || '', io);
      socket.join(`task:${result.taskId}`);

      socket.emit('task:launched', {
        taskId: result.taskId,
        dag: result.dag,
      });
    } catch (err) {
      console.error('[socket] task:launch error:', err);
      socket.emit('error', {
        message: err instanceof Error ? err.message : 'Failed to launch task',
      });
    }
  });

  // ── MCP Socket Events ────────────────────────────────────────────────────

  socket.on('mcp:start', async (data: { serverId: string; env?: Record<string, string> }) => {
    try {
      const server = await mcpManager.startServer(data.serverId, data.env);
      socket.emit('mcp:started', {
        id: server.id,
        name: server.config.name,
        status: server.status,
        tools: server.tools.map((t) => ({ name: t.name, description: t.description })),
      });
    } catch (err) {
      socket.emit('mcp:error', {
        serverId: data.serverId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  socket.on('mcp:stop', async (data: { serverId: string }) => {
    try {
      await mcpManager.stopServer(data.serverId);
      socket.emit('mcp:stopped', { serverId: data.serverId });
    } catch (err) {
      socket.emit('mcp:error', {
        serverId: data.serverId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  socket.on('mcp:call-tool', async (data: { serverId: string; toolName: string; args?: Record<string, unknown> }) => {
    try {
      const result = await mcpManager.callTool(data.serverId, data.toolName, data.args || {});
      socket.emit('mcp:tool-result', {
        serverId: data.serverId,
        toolName: data.toolName,
        result,
      });
    } catch (err) {
      socket.emit('mcp:error', {
        serverId: data.serverId,
        toolName: data.toolName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ── AutoAgent Socket Events ──────────────────────────────────────────────

  socket.on('autoagent:subscribe', (agentId: string) => {
    socket.join(`autoagent:${agentId}`);
    console.log(`[socket] ${socket.id} subscribed to autoagent:${agentId}`);
  });

  socket.on('autoagent:unsubscribe', (agentId: string) => {
    socket.leave(`autoagent:${agentId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

// ── Error handling middleware (must be last) ───────────────────────────────────
app.use(errorHandler);

// ── Graceful shutdown ───────────────────────────────────────────────────────────
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[server] Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('[server] HTTP server closed');
  });

  // Stop resource monitoring
  resourceMonitor.stop();

  // Stop all MCP servers
  await mcpManager.stopAll();

  // Close Socket.IO
  io.close(() => {
    console.log('[server] Socket.IO server closed');
  });

  console.log('[server] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[server] Unhandled rejection at:', promise, 'reason:', reason);
});

// ── Start Server ────────────────────────────────────────────────────────────
async function start() {
  // Start resource monitoring
  resourceMonitor.start(60000); // every 60 seconds

  // Start auto backup scheduler
  const backupScheduler = new AutoBackupScheduler(24, 7); // daily backup, keep 7
  backupScheduler.start();

  // Seed the database
  await seedAgentsCatalog();

  server.listen(config.PORT, () => {
    console.log(`[server] AI Agency backend running on http://localhost:${config.PORT}`);
    console.log(`[server] API available at http://localhost:${config.PORT}/api`);
    console.log(`[server] Database: ${config.DB_PATH}`);
    console.log(`[server] Node.js ${process.version} | Platform: ${process.platform}`);
    console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});

export { app, server, io };
