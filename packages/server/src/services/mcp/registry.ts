// ── MCP Server Registry ──────────────────────────────────────────────────────
// Catalog of available MCP server configurations.

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  tools: string[];
  env?: string[];
  description?: string;
}

export const MCP_SERVERS: MCPServerConfig[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
    tools: ['read_file', 'write_file', 'list_directory'],
    description: 'Read, write, and list files on the local filesystem',
  },
  {
    id: 'github',
    name: 'GitHub',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: ['GITHUB_TOKEN'],
    tools: ['search_repos', 'create_issue', 'list_prs'],
    description: 'Interact with GitHub repositories, issues, and pull requests',
  },
  {
    id: 'memory',
    name: 'Memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    tools: ['store', 'retrieve', 'search'],
    description: 'Persistent key-value memory across sessions',
  },
  {
    id: 'fetch',
    name: 'Fetch',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    tools: ['fetch_url', 'scrape_page'],
    description: 'Fetch URLs and scrape web pages',
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: ['BRAVE_API_KEY'],
    tools: ['web_search', 'local_search'],
    description: 'Search the web using Brave Search API',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: ['DATABASE_URL'],
    tools: ['query', 'list_tables', 'describe_table'],
    description: 'Query and inspect PostgreSQL databases',
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    tools: ['navigate', 'screenshot', 'click', 'type'],
    description: 'Automate browser interactions via Puppeteer',
  },
  {
    id: 'slack',
    name: 'Slack',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: ['SLACK_TOKEN'],
    tools: ['send_message', 'read_channel', 'list_channels'],
    description: 'Send and read Slack messages',
  },
];

export function getMCPServerConfig(serverId: string): MCPServerConfig | undefined {
  return MCP_SERVERS.find((s) => s.id === serverId);
}

export function getAllMCPServerConfigs(): MCPServerConfig[] {
  return [...MCP_SERVERS];
}
