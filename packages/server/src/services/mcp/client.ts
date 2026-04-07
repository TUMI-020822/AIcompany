// ── MCP JSON-RPC Client ──────────────────────────────────────────────────────
// Communicates with MCP server subprocesses over stdio using JSON-RPC 2.0.

import type { ChildProcess } from 'child_process';

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class MCPClient {
  private process: ChildProcess;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private buffer = '';
  private initialized = false;
  private serverCapabilities: Record<string, unknown> = {};

  constructor(childProcess: ChildProcess) {
    this.process = childProcess;
    this.setupStdoutListener();
  }

  private setupStdoutListener(): void {
    if (!this.process.stdout) {
      throw new Error('MCP server process has no stdout');
    }

    this.process.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf-8');
      this.processBuffer();
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8').trim();
      if (text) {
        console.error(`[mcp-client] stderr: ${text}`);
      }
    });
  }

  private processBuffer(): void {
    // MCP uses newline-delimited JSON-RPC messages
    const lines = this.buffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg = JSON.parse(trimmed) as JSONRPCResponse;
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const pending = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          clearTimeout(pending.timer);

          if (msg.error) {
            pending.reject(new Error(`MCP RPC error ${msg.error.code}: ${msg.error.message}`));
          } else {
            pending.resolve(msg.result);
          }
        }
        // Ignore notifications (no id) for now
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  private sendRequest(method: string, params?: Record<string, unknown>, timeoutMs = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process.stdin || this.process.killed) {
        reject(new Error('MCP server process is not available'));
        return;
      }

      const id = this.nextId++;
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params: params || {},
      };

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      const data = JSON.stringify(request) + '\n';
      this.process.stdin.write(data, (err) => {
        if (err) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(new Error(`Failed to write to MCP server stdin: ${err.message}`));
        }
      });
    });
  }

  async initialize(): Promise<Record<string, unknown>> {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'ai-agency',
        version: '1.0.0',
      },
    }, 15000);

    this.serverCapabilities = result?.capabilities || {};
    this.initialized = true;

    // Send initialized notification
    if (this.process.stdin && !this.process.killed) {
      const notification = JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }) + '\n';
      this.process.stdin.write(notification);
    }

    return result;
  }

  async listTools(): Promise<MCPToolDefinition[]> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized. Call initialize() first.');
    }

    const result = await this.sendRequest('tools/list', {}, 15000);
    return (result?.tools || []) as MCPToolDefinition[];
  }

  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<MCPToolResult> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized. Call initialize() first.');
    }

    const result = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    }, 30000);

    return result as MCPToolResult;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCapabilities(): Record<string, unknown> {
    return { ...this.serverCapabilities };
  }

  destroy(): void {
    // Reject all pending requests
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('MCP client destroyed'));
    }
    this.pending.clear();
    this.initialized = false;
  }
}
