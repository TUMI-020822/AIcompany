/**
 * API 错误处理工具
 */

export interface ApiError {
  category: string;
  message: string;
  suggestion?: string;
  isRecoverable: boolean;
  retryAfter?: number;
}

export function parseApiError(response: any): ApiError {
  if (response.error) {
    return {
      category: response.error.category || 'UNKNOWN_ERROR',
      message: response.error.message || 'Unknown error',
      suggestion: response.error.suggestion,
      isRecoverable: response.error.isRecoverable ?? false,
      retryAfter: response.error.retryAfter,
    };
  }

  return {
    category: 'UNKNOWN_ERROR',
    message: response.message || 'An unexpected error occurred',
    isRecoverable: false,
  };
}

export function getErrorToast(error: ApiError): {
  type: 'error' | 'warning';
  message: string;
  suggestion?: string;
} {
  const userFriendlyMessages: Record<string, string> = {
    LLM_API_KEY_MISSING: 'API Key 未配置',
    LLM_RATE_LIMITED: '请求过于频繁，请稍后重试',
    LLM_TIMEOUT: '请求超时，请检查网络连接',
    LLM_CONTEXT_TOO_LONG: '内容过长，请简化后重试',
    LLM_MODEL_NOT_FOUND: '模型不可用，请检查配置',
    DAG_NO_AGENTS: '公司尚未雇佣代理，请先雇佣代理',
    MCP_SERVER_NOT_RUNNING: 'MCP 服务未启动',
    DB_CONNECTION_FAILED: '数据库连接失败',
    SYSTEM_PERMISSION_DENIED: '权限不足',
  };

  return {
    type: error.isRecoverable ? 'warning' : 'error',
    message: userFriendlyMessages[error.category] || error.message,
    suggestion: error.suggestion,
  };
}

/**
 * 带 retry 的 fetch 封装
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (response.ok) {
        return response;
      }

      // 如果是 4xx 错误，不重试
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // 5xx 错误，等待后重试
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (err) {
      lastError = err as Error;

      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}
