import { DynamicTool } from '@langchain/core/tools';
import { mcpManager } from '../mcp/manager.js';
import { executeSkill } from '../skills/executor.js';

// Create LangChain tools from MCP servers and skills
export function createLangChainTools(mcpServers: string[], skills: string[]) {
  const tools: DynamicTool[] = [];

  // Add MCP server tools
  for (const serverId of mcpServers) {
    const server = mcpManager.getServer(serverId);
    if (server && server.status === 'running') {
      for (const tool of server.tools) {
        tools.push(new DynamicTool({
          name: `${serverId}::${tool.name}`,
          description: tool.description || 'No description',
          func: async (input: string) => {
            try {
              const args = input ? JSON.parse(input) : {};
              const result = await mcpManager.callTool(serverId, tool.name, args);
              return result.content
                ?.map((c: any) => c.text || '')
                .filter(Boolean)
                .join('\n') || 'Tool returned empty result';
            } catch (error) {
              return `Error: ${error instanceof Error ? error.message : String(error)}`;
            }
          },
        }));
      }
    }
  }

  // Add built-in skills as tools
  for (const skillId of skills) {
    tools.push(new DynamicTool({
      name: `skill::${skillId}`,
      description: `Execute the ${skillId} skill`,
      func: async (input: string) => {
        try {
          const args = input ? JSON.parse(input) : {};
          const result = await executeSkill(skillId, args);
          return result.success ? result.output : `Error: ${result.error}`;
        } catch (error) {
          return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    }));
  }

  return tools;
}
