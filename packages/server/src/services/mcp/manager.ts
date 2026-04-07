// ── MCP Server Lifecycle Manager ─────────────────────────────────────────────
// Spawns, tracks, and stops MCP server subprocesses.

import { spawn, type ChildProcess } from 'child_process';
import { MCPClient, type MCPToolDefinition } from './client.js';
import { getMCPServerConfig, type MCPServerConfig } from './registry.js';

export type MCPServerStatus = 'starting' | 'running' | 'error' | 'stopped';

export interface RunningMCPServer {
  id: string;
  config: MCPServerConfig;
  status: MCPServerStatus;
  process: ChildProcess;
  client: MCPClient;
  tools: MCPToolDefinition[];
  error?: string;
  startedAt: number;
}

class MCPManager {
  private servers = new Map<string, RunningMCPServer>();

  async startServer(
    serverId: string,
    envOverrides?: Record<string, string>,
  ): Promise<RunningMCPServer> {
    // If already running, return it
    const existing = this.servers.get(serverId);
    if (existing && existing.status === 'running') {
      return existing;
    }

    // Stop any existing instance first
    if (existing) {
      await this.stopServer(serverId);
    }

    const config = getMCPServerConfig(serverId);
    if (!config) {
      throw new Error(`Unknown MCP server: ${serverId}`);
    }

    // Build environment variables
    const processEnv: Record<string, string> = { ...process.env as Record<string, string> };
    if (envOverrides) {
      Object.assign(processEnv, envOverrides);
    }

    // Check required env vars
    if (config.env) {
      for (const envVar of config.env) {
        if (!processEnv[envVar] && !envOverrides?.[envVar]) {
          console.warn(`[mcp-manager] Warning: ${envVar} not set for ${serverId}`);
        }
      }
    }

    const entry: RunningMCPServer = {
      id: serverId,
      config,
      status: 'starting',
      process: null as any,
      client: null as any,
      tools: [],
      startedAt: Date.now(),
    };

    try {
      // Spawn the MCP server subprocess
      const child = spawn(config.command, config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: processEnv,
        shell: false,
      });

      entry.process = child;

      // Handle process exit
      child.on('exit', (code, signal) => {
        console.log(`[mcp-manager] Server ${serverId} exited (code=${code}, signal=${signal})`);
        const srv = this.servers.get(serverId);
        if (srv && srv.status !== 'stopped') {
          srv.status = 'error';
          srv.error = `Process exited with code ${code}`;
          srv.client?.destroy();
        }
      });

      child.on('error', (err) => {
        console.error(`[mcp-manager] Server ${serverId} process error:`, err.message);
        const srv = this.servers.get(serverId);
        if (srv) {
          srv.status = 'error';
          srv.error = err.message;
        }
      });

      // Create client and initialize
      const client = new MCPClient(child);
      entry.client = client;

      this.servers.set(serverId, entry);

      // Initialize with a timeout wrapper
      await client.initialize();

      // Discover tools
      const tools = await client.listTools();
      entry.tools = tools;
      entry.status = 'running';

      console.log(`[mcp-manager] Server ${serverId} running with ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);

      return entry;
    } catch (err) {
      entry.status = 'error';
      entry.error = err instanceof Error ? err.message : String(err);
      console.error(`[mcp-manager] Failed to start ${serverId}:`, entry.error);

      // Kill the process if it was spawned
      if (entry.process && !entry.process.killed) {
        entry.process.kill('SIGTERM');
      }

      this.servers.set(serverId, entry);
      throw err;
    }
  }

  async stopServer(serverId: string): Promise<void> {
    const entry = this.servers.get(serverId);
    if (!entry) return;

    entry.status = 'stopped';
    entry.client?.destroy();

    if (entry.process && !entry.process.killed) {
      entry.process.kill('SIGTERM');

      // Force kill after 5 seconds
      const forceKillTimer = setTimeout(() => {
        if (entry.process && !entry.process.killed) {
          entry.process.kill('SIGKILL');
        }
      }, 5000);

      entry.process.on('exit', () => {
        clearTimeout(forceKillTimer);
      });
    }

    this.servers.delete(serverId);
    console.log(`[mcp-manager] Server ${serverId} stopped`);
  }

  getServer(serverId: string): RunningMCPServer | undefined {
    return this.servers.get(serverId);
  }

  getRunningServers(): RunningMCPServer[] {
    return Array.from(this.servers.values());
  }

  getServerStatus(serverId: string): MCPServerStatus | 'not_started' {
    const entry = this.servers.get(serverId);
    return entry ? entry.status : 'not_started';
  }

  getServerTools(serverId: string): MCPToolDefinition[] {
    const entry = this.servers.get(serverId);
    return entry?.tools || [];
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ) {
    const entry = this.servers.get(serverId);
    if (!entry || entry.status !== 'running') {
      throw new Error(`MCP server ${serverId} is not running`);
    }

    return entry.client.callTool(toolName, args);
  }

  /**
   * Get all tools from all running servers, prefixed with server id.
   * Returns a flat list of {serverId, tool} pairs.
   */
  getAllAvailableTools(): Array<{ serverId: string; tool: MCPToolDefinition }> {
    const result: Array<{ serverId: string; tool: MCPToolDefinition }> = [];
    for (const [serverId, entry] of this.servers) {
      if (entry.status === 'running') {
        for (const tool of entry.tools) {
          result.push({ serverId, tool });
        }
      }
    }
    return result;
  }

  async stopAll(): Promise<void> {
    const ids = Array.from(this.servers.keys());
    await Promise.all(ids.map((id) => this.stopServer(id)));
  }
}

// Singleton instance
export const mcpManager = new MCPManager();
