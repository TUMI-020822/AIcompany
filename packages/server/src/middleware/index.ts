/**
 * 中间件集合
 * - 错误处理
 * - 请求限流
 * - 请求日志
 * - 超时处理
 */

import type { Request, Response, NextFunction } from 'express';
import { classifyError, AgencyError, errorLogger } from '../utils/errors.js';

// ── 错误处理中间件 ───────────────────────────────────────────────────────────

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const agencyError = err instanceof AgencyError ? err : classifyError(err);

  // 记录错误
  errorLogger.log(agencyError, {
    taskId: req.params.taskId,
    agentId: req.params.agentId,
    userId: (req as any).userId,
  });

  // 构建响应
  const statusCode = getStatusCode(agencyError.category);

  res.status(statusCode).json({
    error: {
      category: agencyError.category,
      message: agencyError.message,
      suggestion: agencyError.suggestion,
      isRecoverable: agencyError.isRecoverable,
      retryAfter: agencyError.retryAfter,
    },
  });
}

function getStatusCode(category: string): number {
  switch (category) {
    case 'LLM_API_KEY_MISSING':
    case 'LLM_MODEL_NOT_FOUND':
      return 401;
    case 'LLM_RATE_LIMITED':
      return 429;
    case 'LLM_CONTEXT_TOO_LONG':
      return 413;
    case 'MCP_SERVER_NOT_RUNNING':
    case 'DAG_NO_AGENTS':
      return 400;
    case 'SYSTEM_PERMISSION_DENIED':
      return 403;
    case 'SYSTEM_FILE_NOT_FOUND':
      return 404;
    case 'DB_CONNECTION_FAILED':
    case 'DB_QUERY_FAILED':
      return 503;
    default:
      return 500;
  }
}

// ── 请求限流 ─────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private requests = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // 定期清理过期条目
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.requests) {
        if (now > entry.resetTime) {
          this.requests.delete(key);
        }
      }
    }, windowMs);
  }

  middleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = this.getKey(req);
    const now = Date.now();

    let entry = this.requests.get(key);
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.windowMs,
      };
      this.requests.set(key, entry);
    }

    entry.count++;

    // 设置响应头
    res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, this.maxRequests - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));

    if (entry.count > this.maxRequests) {
      res.status(429).json({
        error: {
          category: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        },
      });
      return;
    }

    next();
  };

  private getKey(req: Request): string {
    // 使用 IP 地址作为标识
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const path = req.path;
    return `${ip}:${path}`;
  }
}

// 默认限流器：每分钟 100 请求
export const defaultRateLimiter = new RateLimiter(60000, 100);

// API 限流器：每分钟 60 请求
export const apiRateLimiter = new RateLimiter(60000, 60);

// ── 请求日志 ─────────────────────────────────────────────────────────────────

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLine = `${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`;

    // 根据状态码选择日志级别
    if (res.statusCode >= 500) {
      console.error(`[request] ${logLine}`);
    } else if (res.statusCode >= 400) {
      console.warn(`[request] ${logLine}`);
    } else {
      console.log(`[request] ${logLine}`);
    }
  });

  next();
}

// ── 超时处理 ─────────────────────────────────────────────────────────────────

export function timeoutMiddleware(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: {
            category: 'REQUEST_TIMEOUT',
            message: `Request timeout after ${timeoutMs}ms`,
            suggestion: 'The operation took too long. Try with a simpler request or increase timeout.',
          },
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
}

// ── 请求验证 ─────────────────────────────────────────────────────────────────

export function validateBody(schema: { validate: (data: unknown) => { error?: { details: Array<{ message: string }> }; value: unknown } }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.validate(req.body);

    if (result.error) {
      res.status(400).json({
        error: {
          category: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: result.error.details.map((d) => d.message),
        },
      });
      return;
    }

    next();
  };
}

// ── CORS 预检 ─────────────────────────────────────────────────────────────────

export function corsPreflight(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }
  next();
}
