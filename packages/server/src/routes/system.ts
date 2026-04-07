import { Router } from 'express';
import { performHealthCheck, errorLogger } from '../utils/errors.js';
import { generatePerformanceReport, resourceMonitor } from '../utils/performance.js';

const router = Router();

/**
 * GET /api/system/health
 * 健康检查端点
 */
router.get('/health', async (req, res) => {
  try {
    const result = await performHealthCheck();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/system/performance
 * 性能报告端点
 */
router.get('/performance', (req, res) => {
  try {
    const report = generatePerformanceReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate performance report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/system/resources
 * 实时资源使用情况
 */
router.get('/resources', (req, res) => {
  try {
    const usage = resourceMonitor.getCurrentUsage();
    const history = resourceMonitor.getHistory(10);
    const avg = resourceMonitor.getAverageOver(5);

    res.json({
      current: usage,
      history,
      average5min: avg,
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get resource usage',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/system/errors
 * 错误统计（从日志读取）
 */
router.get('/errors', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logPath = './logs/errors.log';

    try {
      const content = await import('fs/promises').then((fs) => fs.readFile(logPath, 'utf-8'));
      const lines = content.trim().split('\n').slice(-limit);
      const errors = lines.map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      });

      // 统计错误类型
      const byCategory: Record<string, number> = {};
      for (const err of errors) {
        if (err.category) {
          byCategory[err.category] = (byCategory[err.category] || 0) + 1;
        }
      }

      res.json({
        total: errors.length,
        byCategory,
        recent: errors.slice(-20),
      });
    } catch {
      res.json({
        total: 0,
        byCategory: {},
        recent: [],
        message: 'No error logs found',
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read error logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/system/gc
 * 手动触发垃圾回收（如果可用）
 */
router.post('/gc', (req, res) => {
  if (global.gc) {
    const before = process.memoryUsage();
    global.gc();
    const after = process.memoryUsage();

    res.json({
      success: true,
      before: {
        heapUsed: before.heapUsed,
        heapTotal: before.heapTotal,
      },
      after: {
        heapUsed: after.heapUsed,
        heapTotal: after.heapTotal,
      },
      freed: before.heapUsed - after.heapUsed,
    });
  } else {
    res.json({
      success: false,
      message: 'Garbage collection not exposed. Run with --expose-gc flag.',
    });
  }
});

/**
 * GET /api/system/config
 * 获取公开的配置信息
 */
router.get('/config', (req, res) => {
  const { config } = await import('../config.js');
  res.json({
    port: config.PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    ollamaBaseUrl: config.OLLAMA_BASE_URL,
    hasApiKeys: {
      deepseek: !!config.DEEPSEEK_API_KEY,
      openai: !!config.OPENAI_API_KEY,
      anthropic: !!config.ANTHROPIC_API_KEY,
      google: !!config.GOOGLE_AI_API_KEY,
    },
  });
});

export default router;
