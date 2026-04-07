/**
 * 错误处理工具类
 * 提供统一的错误分类、日志记录和恢复机制
 */

import fs from 'fs/promises';
import path from 'path';

// ── 错误类型定义 ─────────────────────────────────────────────────────────────

export enum ErrorCategory {
  // LLM 相关
  LLM_API_KEY_MISSING = 'LLM_API_KEY_MISSING',
  LLM_RATE_LIMITED = 'LLM_RATE_LIMITED',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_CONTEXT_TOO_LONG = 'LLM_CONTEXT_TOO_LONG',
  LLM_MODEL_NOT_FOUND = 'LLM_MODEL_NOT_FOUND',
  LLM_PROVIDER_ERROR = 'LLM_PROVIDER_ERROR',

  // MCP 相关
  MCP_SERVER_NOT_RUNNING = 'MCP_SERVER_NOT_RUNNING',
  MCP_TOOL_NOT_FOUND = 'MCP_TOOL_NOT_FOUND',
  MCP_EXECUTION_FAILED = 'MCP_EXECUTION_FAILED',

  // DAG/Orchestrator 相关
  DAG_NO_AGENTS = 'DAG_NO_AGENTS',
  DAG_PLANNING_FAILED = 'DAG_PLANNING_FAILED',
  DAG_EXECUTION_FAILED = 'DAG_EXECUTION_FAILED',

  // Skills 相关
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',
  SKILL_EXECUTION_FAILED = 'SKILL_EXECUTION_FAILED',

  // 数据库相关
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',

  // 系统相关
  SYSTEM_FILE_NOT_FOUND = 'SYSTEM_FILE_NOT_FOUND',
  SYSTEM_PERMISSION_DENIED = 'SYSTEM_PERMISSION_DENIED',
  SYSTEM_OUT_OF_MEMORY = 'SYSTEM_OUT_OF_MEMORY',

  // 通用
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AgencyError extends Error {
  public readonly category: ErrorCategory;
  public readonly isRecoverable: boolean;
  public readonly retryAfter?: number;
  public readonly suggestion?: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    category: ErrorCategory,
    message: string,
    options?: {
      isRecoverable?: boolean;
      retryAfter?: number;
      suggestion?: string;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, options?.cause);
    this.name = 'AgencyError';
    this.category = category;
    this.isRecoverable = options?.isRecoverable ?? false;
    this.retryAfter = options?.retryAfter;
    this.suggestion = options?.suggestion;
    this.context = options?.context;
  }

  toJSON() {
    return {
      name: this.name,
      category: this.category,
      message: this.message,
      isRecoverable: this.isRecoverable,
      retryAfter: this.retryAfter,
      suggestion: this.suggestion,
      context: this.context,
      stack: this.stack,
    };
  }
}

// ── 错误分类器 ───────────────────────────────────────────────────────────────

export function classifyError(error: unknown): AgencyError {
  if (error instanceof AgencyError) {
    return error;
  }

  const err = error as Error;
  const message = err?.message?.toLowerCase() || '';
  const errName = (err as any)?.name?.toLowerCase() || '';

  // LLM 错误
  if (message.includes('api key') || message.includes('api_key') || message.includes('unauthorized')) {
    return new AgencyError(ErrorCategory.LLM_API_KEY_MISSING, err.message, {
      isRecoverable: true,
      suggestion: '请检查 API Key 配置，确保已正确设置且有效',
      cause: err,
    });
  }

  if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
    const retryMatch = message.match(/retry.?after[:\s]*(\d+)/i);
    const retryAfter = retryMatch ? parseInt(retryMatch[1]) * 1000 : 60000;
    return new AgencyError(ErrorCategory.LLM_RATE_LIMITED, err.message, {
      isRecoverable: true,
      retryAfter,
      suggestion: `API 请求频率超限，请等待 ${Math.ceil(retryAfter / 1000)} 秒后重试`,
      cause: err,
    });
  }

  if (message.includes('timeout') || message.includes('etimedout') || errName === 'timeouterror') {
    return new AgencyError(ErrorCategory.LLM_TIMEOUT, err.message, {
      isRecoverable: true,
      suggestion: '请求超时，请检查网络连接或稍后重试',
      cause: err,
    });
  }

  if (message.includes('context length') || message.includes('token limit') || message.includes('too long')) {
    return new AgencyError(ErrorCategory.LLM_CONTEXT_TOO_LONG, err.message, {
      isRecoverable: true,
      suggestion: '输入内容过长，请简化任务描述或分段处理',
      cause: err,
    });
  }

  if (message.includes('model') && (message.includes('not found') || message.includes('does not exist'))) {
    return new AgencyError(ErrorCategory.LLM_MODEL_NOT_FOUND, err.message, {
      isRecoverable: false,
      suggestion: '指定的模型不存在，请检查模型名称是否正确',
      cause: err,
    });
  }

  // MCP 错误
  if (message.includes('mcp') && message.includes('not running')) {
    return new AgencyError(ErrorCategory.MCP_SERVER_NOT_RUNNING, err.message, {
      isRecoverable: true,
      suggestion: 'MCP 服务器未启动，请先启动相应的 MCP 服务器',
      cause: err,
    });
  }

  if (message.includes('tool') && message.includes('not found')) {
    return new AgencyError(ErrorCategory.MCP_TOOL_NOT_FOUND, err.message, {
      isRecoverable: false,
      suggestion: '请求的工具不存在，请检查工具名称',
      cause: err,
    });
  }

  // DAG 错误
  if (message.includes('no hired agents') || message.includes('no agents available')) {
    return new AgencyError(ErrorCategory.DAG_NO_AGENTS, err.message, {
      isRecoverable: true,
      suggestion: '公司尚未雇佣任何代理，请先雇佣代理',
      cause: err,
    });
  }

  // 数据库错误
  if (message.includes('database') || message.includes('sqlite') || message.includes('sql')) {
    return new AgencyError(ErrorCategory.DB_QUERY_FAILED, err.message, {
      isRecoverable: false,
      suggestion: '数据库操作失败，请检查数据库状态',
      cause: err,
    });
  }

  // 文件系统错误
  if (errName === 'enoent' || message.includes('no such file')) {
    return new AgencyError(ErrorCategory.SYSTEM_FILE_NOT_FOUND, err.message, {
      isRecoverable: false,
      suggestion: '请求的文件不存在',
      cause: err,
    });
  }

  if (errName === 'eacces' || errName === 'eperm' || message.includes('permission')) {
    return new AgencyError(ErrorCategory.SYSTEM_PERMISSION_DENIED, err.message, {
      isRecoverable: false,
      suggestion: '权限不足，无法执行该操作',
      cause: err,
    });
  }

  // 默认：未知错误
  return new AgencyError(ErrorCategory.UNKNOWN_ERROR, err.message || 'Unknown error', {
    isRecoverable: false,
    cause: err,
  });
}

// ── 重试机制 ─────────────────────────────────────────────────────────────────

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: AgencyError) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = (err) => err.isRecoverable,
  } = options;

  let lastError: AgencyError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = classifyError(error);

      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      // 计算延迟（指数退避）
      const delay = Math.min(
        lastError.retryAfter || baseDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      console.warn(`[retry] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ── 错误日志记录器 ───────────────────────────────────────────────────────────

class ErrorLogger {
  private logPath: string;
  private maxSize: number = 10 * 1024 * 1024; // 10MB

  constructor(logPath: string = './logs/errors.log') {
    this.logPath = logPath;
    this.ensureLogDir();
  }

  private async ensureLogDir() {
    const dir = path.dirname(this.logPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // ignore
    }
  }

  async log(error: AgencyError, context?: { taskId?: string; agentId?: string; userId?: string }) {
    const entry = {
      timestamp: new Date().toISOString(),
      category: error.category,
      message: error.message,
      isRecoverable: error.isRecoverable,
      suggestion: error.suggestion,
      context: { ...error.context, ...context },
      stack: error.stack,
    };

    const line = JSON.stringify(entry) + '\n';

    try {
      // 检查日志文件大小，超过限制则轮转
      try {
        const stats = await fs.stat(this.logPath);
        if (stats.size > this.maxSize) {
          await this.rotateLog();
        }
      } catch {
        // 文件不存在，忽略
      }

      await fs.appendFile(this.logPath, line, 'utf-8');
    } catch (err) {
      console.error('[error-logger] Failed to write error log:', err);
    }

    // 同时输出到控制台
    console.error(`[error] [${error.category}] ${error.message}`);
    if (error.suggestion) {
      console.error(`[error] Suggestion: ${error.suggestion}`);
    }
  }

  private async rotateLog() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = this.logPath.replace('.log', `.${timestamp}.log`);
    try {
      await fs.rename(this.logPath, rotatedPath);
    } catch {
      // ignore
    }
  }
}

export const errorLogger = new ErrorLogger();

// ── 健康检查 ─────────────────────────────────────────────────────────────────

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { status: 'ok' | 'error'; message?: string; latency?: number }>;
  timestamp: string;
}

export async function performHealthCheck(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = {};
  let hasError = false;

  // 检查数据库
  try {
    const start = Date.now();
    const { db } = await import('../db/index.js');
    const { companies } = await import('../db/schema.js');
    // sql.js 不支持 drizzle 的 .all() 方法，使用简单查询测试
    const { sqlite } = await import('../db/index.js');
    sqlite.exec('SELECT 1');
    checks.database = { status: 'ok', latency: Date.now() - start };
  } catch (err) {
    checks.database = { status: 'error', message: (err as Error).message };
    hasError = true;
  }

  // 检查数据目录
  try {
    const start = Date.now();
    await fs.access('./data');
    checks.dataDir = { status: 'ok', latency: Date.now() - start };
  } catch {
    checks.dataDir = { status: 'error', message: 'Data directory not accessible' };
    hasError = true;
  }

  // 检查环境变量
  const hasApiKey = !!(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
  checks.apiKeys = {
    status: hasApiKey ? 'ok' : 'error',
    message: hasApiKey ? 'At least one API key configured' : 'No API keys configured',
  };

  return {
    status: hasError ? 'unhealthy' : 'healthy',
    checks,
    timestamp: new Date().toISOString(),
  };
}
