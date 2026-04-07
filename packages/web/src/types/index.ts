// ====== Core Entity Types ======

export interface Company {
  id: string;
  name: string;
  industry: string;
  desc: string;
  created: number;
  employees: string[];
  tasks: Task[];
  employeeConfigs: Record<string, AgentConfig>;
  customDepts?: CustomDept[];
  customAgents?: Agent[];
}

export interface CustomDept {
  name: string;
  color: string;
}

export interface Agent {
  id: string;
  name: string;
  dept: string;
  desc: string;
  tags: string[];
  role: string;
  custom?: boolean;
}

export interface AgentConfig {
  provider: string;
  model: string;
  customModel?: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  skills: string[];
  customSkills?: CustomSkill[];
  mcpServers: MCPServer[];
  autoagent: AutoAgentConfig;
}

export interface CustomSkill {
  name: string;
  desc: string;
}

export interface AutoAgentConfig {
  enabled: boolean;
  programMd: string;
  benchTasks: string;
  score: number;
  iterations: number;
  bestScore: number;
  log: OptimizationLogEntry[];
}

export interface OptimizationLogEntry {
  text: string;
  type?: string;
}

export interface Conversation {
  id: string;
  name: string;
  type: 'group' | 'dept' | 'agent';
  dept?: string;
  agent?: Agent;
  preview: string;
  time: number;
  unread?: number;
  color: string;
}

export interface Message {
  self: boolean;
  sender: string;
  text: string;
  color?: string;
  time: string;
  typing?: boolean;
}

export interface Task {
  id: string;
  name: string;
  desc: string;
  status: 'running' | 'done' | 'failed';
  created: number;
  steps: TaskStep[];
  outputs: TaskOutput[];
}

export interface TaskStep {
  id?: string;
  label?: string;
  agentId?: string;
  status?: 'pending' | 'running' | 'done' | 'waiting' | 'failed';
  parallel?: boolean;
  items?: TaskStep[];
}

export interface TaskOutput {
  title: string;
  agent: string;
  text: string;
  duration: string;
  tokens: number;
}

export interface Provider {
  id: string;
  name: string;
  models: string[];
  needsKey: boolean;
}

export interface Skill {
  id: string;
  name: string;
  icon: string;
  desc: string;
  category: string;
}

export interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  tools: string[];
  env?: string[];
  status: string;
  connected?: boolean;
}

// ====== Static Data ======

export const DEPT_COLORS: Record<string, string> = {
  '产品部': '#3370ff',
  '工程部': '#6b5ce7',
  '设计部': '#ff6b9d',
  '数据部': '#00b8d9',
  '市场部': '#f5a623',
  '运营部': '#34c759',
  '战略部': '#8b5cf6',
  '法务部': '#64748b',
  'HR部': '#ec4899',
  '创意部': '#f97316',
};

export const AGENTS_DB: Agent[] = [
  // 产品部
  { id: 'pm', name: '产品经理', dept: '产品部', desc: '负责产品规划、需求分析与优先级管理，擅长PRD编写和用户故事拆分', tags: ['需求分析', 'PRD', '用户故事'], role: 'product/product-manager' },
  { id: 'po', name: '产品负责人', dept: '产品部', desc: '统筹产品战略方向，制定产品路线图和OKR目标', tags: ['产品战略', '路线图', 'OKR'], role: 'product/product-owner' },
  { id: 'ba', name: '业务分析师', dept: '产品部', desc: '深入分析业务流程，提炼关键指标和改进建议', tags: ['业务分析', '流程优化', 'KPI'], role: 'product/business-analyst' },
  // 工程部
  { id: 'arch', name: '软件架构师', dept: '工程部', desc: '设计系统架构，评估技术方案可行性，保障系统可扩展性和高可用', tags: ['系统架构', '技术选型', '高可用'], role: 'engineering/engineering-software-architect' },
  { id: 'be', name: '后端工程师', dept: '工程部', desc: '负责服务端开发、API设计、数据库优化和微服务架构实现', tags: ['后端开发', 'API设计', '微服务'], role: 'engineering/engineering-backend' },
  { id: 'fe', name: '前端工程师', dept: '工程部', desc: '构建用户界面，实现交互逻辑和性能优化', tags: ['前端开发', 'React/Vue', '性能优化'], role: 'engineering/engineering-frontend' },
  { id: 'sre', name: 'SRE工程师', dept: '工程部', desc: '保障系统稳定运行，构建监控告警体系和自动化运维方案', tags: ['运维', '监控', '自动化'], role: 'engineering/engineering-sre' },
  { id: 'sec', name: '安全工程师', dept: '工程部', desc: '负责安全审计、漏洞检测和安全架构设计', tags: ['安全审计', '渗透测试', '合规'], role: 'engineering/engineering-security' },
  { id: 'cr', name: '代码审查员', dept: '工程部', desc: '审查代码质量，确保代码规范和最佳实践', tags: ['Code Review', '代码规范', '重构'], role: 'engineering/engineering-code-reviewer' },
  { id: 'qa', name: '测试分析师', dept: '工程部', desc: '设计测试策略，执行自动化测试和质量保障', tags: ['测试策略', '自动化测试', 'QA'], role: 'engineering/engineering-qa' },
  { id: 'dba', name: '数据库优化师', dept: '工程部', desc: '负责数据库设计、查询优化和数据迁移', tags: ['SQL优化', '数据建模', '迁移'], role: 'engineering/engineering-dba' },
  // 设计部
  { id: 'uxr', name: 'UX研究员', dept: '设计部', desc: '开展用户研究，产出用户画像和体验地图', tags: ['用户研究', '可用性测试', '体验地图'], role: 'design/design-ux-researcher' },
  { id: 'uid', name: 'UI设计师', dept: '设计部', desc: '设计视觉界面、组件库和设计系统', tags: ['视觉设计', '组件库', 'Design System'], role: 'design/design-ui-designer' },
  { id: 'uxa', name: 'UX架构师', dept: '设计部', desc: '规划信息架构和交互流程，优化用户体验', tags: ['信息架构', '交互设计', '导航设计'], role: 'design/design-ux-architect' },
  // 数据部
  { id: 'da', name: '数据分析师', dept: '数据部', desc: '挖掘数据洞察，构建数据看板和分析报告', tags: ['数据分析', '报表', 'Python'], role: 'data/data-analyst' },
  { id: 'de', name: '数据工程师', dept: '数据部', desc: '搭建数据管道，优化ETL流程和数据仓库', tags: ['ETL', '数据管道', '数据仓库'], role: 'data/data-engineer' },
  { id: 'ds', name: '数据科学家', dept: '数据部', desc: '构建预测模型和推荐系统，应用机器学习解决业务问题', tags: ['机器学习', '预测模型', '推荐系统'], role: 'data/data-scientist' },
  // 市场部
  { id: 'seo', name: 'SEO专家', dept: '市场部', desc: '优化搜索引擎排名，制定内容营销策略', tags: ['SEO', '内容营销', '关键词'], role: 'marketing/marketing-seo' },
  { id: 'gm', name: '增长黑客', dept: '市场部', desc: '设计增长实验，优化转化漏斗和用户获取', tags: ['增长策略', 'A/B测试', '转化优化'], role: 'marketing/marketing-growth' },
  { id: 'cc', name: '内容创作者', dept: '市场部', desc: '创作优质营销内容、品牌故事和传播文案', tags: ['文案', '品牌故事', '内容策略'], role: 'marketing/marketing-content-creator' },
  { id: 'sm', name: '社交媒体运营', dept: '市场部', desc: '管理社交媒体账号，策划话题活动和用户互动', tags: ['社媒运营', '话题策划', 'KOL合作'], role: 'marketing/marketing-social-media' },
  { id: 'xhs', name: '小红书运营专家', dept: '市场部', desc: '策划小红书种草内容，提升笔记曝光和互动率', tags: ['小红书', '种草', '笔记优化'], role: 'china/xiaohongshu-expert' },
  // 运营部
  { id: 'pjm', name: '项目经理', dept: '运营部', desc: '管理项目进度、资源和风险，确保按时交付', tags: ['项目管理', '敏捷', '风险控制'], role: 'operations/operations-project-manager' },
  { id: 'ma', name: '会议助手', dept: '运营部', desc: '记录会议纪要，追踪行动项和决议', tags: ['会议纪要', '行动项', '决议追踪'], role: 'operations/operations-meeting-assistant' },
  { id: 'es', name: '高管摘要师', dept: '运营部', desc: '将复杂信息提炼为高管级别的简洁摘要', tags: ['高管报告', '信息提炼', '决策支持'], role: 'operations/operations-executive-summary' },
  // 战略部
  { id: 'tr', name: '趋势研究员', dept: '战略部', desc: '跟踪行业趋势和竞品动态，产出市场洞察报告', tags: ['趋势分析', '竞品研究', '市场洞察'], role: 'strategy/strategy-trend-researcher' },
  { id: 'fp', name: '财务预测师', dept: '战略部', desc: '构建财务模型，预测收入和成本，辅助投资决策', tags: ['财务建模', '收入预测', 'ROI'], role: 'strategy/strategy-financial-forecaster' },
  { id: 'st', name: '策略师', dept: '战略部', desc: '制定商业策略和竞争定位方案', tags: ['商业策略', '竞争分析', '市场定位'], role: 'strategy/strategy-strategist' },
  // 法务部
  { id: 'le', name: '合同审查专家', dept: '法务部', desc: '审查合同条款，识别法律风险和合规问题', tags: ['合同审查', '风险识别', '条款分析'], role: 'legal/legal-contract-reviewer' },
  { id: 'lc', name: '法务合规员', dept: '法务部', desc: '确保业务流程符合法规要求，建立合规体系', tags: ['合规审计', '法规解读', '风控'], role: 'legal/legal-compliance' },
  // HR部
  { id: 'hr', name: '招聘专家', dept: 'HR部', desc: '设计招聘流程、面试评估体系和人才画像', tags: ['招聘', '面试设计', '人才评估'], role: 'hr/hr-recruiter' },
  { id: 'psy', name: '组织心理学家', dept: 'HR部', desc: '分析团队动力学，提升组织效能和员工体验', tags: ['组织诊断', '团队建设', '员工体验'], role: 'hr/hr-psychologist' },
  // 创意部
  { id: 'nar', name: '叙事学家', dept: '创意部', desc: '构建叙事结构，设计故事框架和情节节奏', tags: ['叙事设计', '故事结构', '情节节奏'], role: 'creative/creative-narratologist' },
  { id: 'nd', name: '叙事设计师', dept: '创意部', desc: '设计冲突场景、角色弧线和高潮转折', tags: ['冲突设计', '角色弧线', '场景构建'], role: 'creative/creative-narrative-designer' },
  { id: 'vs', name: '视觉叙事师', dept: '创意部', desc: '将故事转化为视觉呈现方案和分镜脚本', tags: ['视觉叙事', '分镜设计', '画面构图'], role: 'creative/creative-visual-storyteller' },
];

export const PROVIDERS: Provider[] = [
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'], needsKey: true },
  { id: 'claude', name: 'Claude', models: ['claude-sonnet-4-20250514', 'claude-3.5-sonnet', 'claude-3-haiku'], needsKey: true },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'], needsKey: true },
  { id: 'gemini', name: 'Gemini', models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-pro'], needsKey: true },
  { id: 'ollama', name: 'Ollama (本地)', models: ['llama3', 'mistral', 'qwen2.5', 'deepseek-r1:7b'], needsKey: false },
  { id: 'claude-code', name: 'Claude Code', models: ['claude-code'], needsKey: false },
  { id: 'gemini-cli', name: 'Gemini CLI', models: ['gemini-cli'], needsKey: false },
  { id: 'copilot-cli', name: 'Copilot CLI', models: ['copilot-cli'], needsKey: false },
  { id: 'codex-cli', name: 'Codex CLI', models: ['codex-cli'], needsKey: false },
  { id: 'custom', name: '自定义(兼容OpenAI)', models: ['custom'], needsKey: true },
];

export const AVAILABLE_SKILLS: Skill[] = [
  { id: 'web-search', name: '网络搜索', icon: '\u{1F50D}', desc: '搜索互联网获取实时信息', category: '信息获取' },
  { id: 'code-exec', name: '代码执行', icon: '\u26A1', desc: '在安全沙箱中执行Python/JS代码', category: '开发工具' },
  { id: 'file-rw', name: '文件读写', icon: '\u{1F4C1}', desc: '读取和写入本地文件系统', category: '系统操作' },
  { id: 'browser', name: '浏览器操作', icon: '\u{1F310}', desc: '自动化浏览器交互、截图、数据抓取', category: '信息获取' },
  { id: 'db-query', name: '数据库查询', icon: '\u{1F5C3}\uFE0F', desc: '连接并查询SQL/NoSQL数据库', category: '数据处理' },
  { id: 'api-call', name: 'API调用', icon: '\u{1F517}', desc: '发起HTTP请求调用外部API', category: '信息获取' },
  { id: 'doc-parse', name: '文档解析', icon: '\u{1F4C4}', desc: '解析PDF、Word、Excel等文档', category: '数据处理' },
  { id: 'img-gen', name: '图像生成', icon: '\u{1F3A8}', desc: '调用AI模型生成和编辑图像', category: '多模态' },
  { id: 'img-ocr', name: '图像识别/OCR', icon: '\u{1F441}\uFE0F', desc: '识别图像内容和文字提取', category: '多模态' },
  { id: 'tts-stt', name: '语音合成/识别', icon: '\u{1F399}\uFE0F', desc: '文字转语音和语音转文字', category: '多模态' },
  { id: 'email', name: '邮件发送', icon: '\u{1F4E7}', desc: '发送和读取电子邮件', category: '通讯' },
  { id: 'calendar', name: '日历管理', icon: '\u{1F4C5}', desc: '创建和管理日历事件', category: '通讯' },
  { id: 'git-ops', name: 'Git操作', icon: '\u{1F500}', desc: '执行Git命令、管理代码仓库', category: '开发工具' },
  { id: 'docker', name: 'Docker管理', icon: '\u{1F433}', desc: '构建和管理Docker容器', category: '开发工具' },
  { id: 'test-run', name: '测试执行', icon: '\u{1F9EA}', desc: '运行单元测试和集成测试', category: '开发工具' },
  { id: 'memory', name: '长期记忆', icon: '\u{1F9E0}', desc: '跨会话持久化记忆和学习', category: '认知增强' },
  { id: 'reasoning', name: '深度推理', icon: '\u{1F914}', desc: 'Chain-of-Thought多步推理增强', category: '认知增强' },
  { id: 'context7', name: 'Context7', icon: '\u{1F4DA}', desc: '获取最新技术文档和API参考', category: '信息获取' },
  { id: 'self-optimize', name: '自我优化(AutoAgent)', icon: '\u{1F504}', desc: '基于评分自动迭代优化prompt和配置', category: '认知增强' },
];

export const DEFAULT_MCP_SERVERS: MCPServer[] = [
  { id: 'filesystem', name: 'Filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'], tools: ['read_file', 'write_file', 'list_directory'], status: 'available' },
  { id: 'github', name: 'GitHub', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], tools: ['search_repos', 'create_issue', 'list_prs'], env: ['GITHUB_TOKEN'], status: 'available' },
  { id: 'postgres', name: 'PostgreSQL', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres'], tools: ['query', 'list_tables', 'describe_table'], env: ['DATABASE_URL'], status: 'available' },
  { id: 'slack', name: 'Slack', command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'], tools: ['send_message', 'read_channel', 'list_channels'], env: ['SLACK_TOKEN'], status: 'available' },
  { id: 'puppeteer', name: 'Puppeteer', command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'], tools: ['navigate', 'screenshot', 'click', 'type'], status: 'available' },
  { id: 'memory', name: 'Memory', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], tools: ['store', 'retrieve', 'search'], status: 'available' },
  { id: 'fetch', name: 'Fetch', command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'], tools: ['fetch_url', 'scrape_page'], status: 'available' },
  { id: 'brave-search', name: 'Brave Search', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'], tools: ['web_search', 'local_search'], env: ['BRAVE_API_KEY'], status: 'available' },
];

// Agent default configs map
export const AGENT_DEFAULTS: Record<string, { skills: string[]; mcp: string[]; program: string; bench: string }> = {
  pm: { skills: ['web-search', 'doc-parse', 'api-call', 'reasoning', 'self-optimize'], mcp: ['filesystem', 'memory'], program: '# 产品经理优化指令\n\n## 目标\n提升需求分析的精准度和PRD文档的专业质量。', bench: '任务1: 分析一个SaaS产品的核心需求并输出PRD' },
  arch: { skills: ['code-exec', 'file-rw', 'web-search', 'reasoning', 'self-optimize'], mcp: ['filesystem', 'github', 'memory'], program: '# 软件架构师优化指令\n\n## 目标\n提升系统架构设计的合理性。', bench: '任务1: 设计一个百万DAU社交应用的后端架构' },
  be: { skills: ['code-exec', 'file-rw', 'db-query', 'git-ops', 'docker', 'test-run', 'api-call', 'self-optimize'], mcp: ['filesystem', 'github', 'postgres', 'memory'], program: '# 后端工程师优化指令\n\n## 目标\n提升后端代码质量和API设计规范性。', bench: '任务1: 实现一个带分页和过滤的RESTful API' },
  fe: { skills: ['code-exec', 'file-rw', 'browser', 'git-ops', 'img-gen', 'self-optimize'], mcp: ['filesystem', 'github', 'puppeteer', 'memory'], program: '# 前端工程师优化指令\n\n## 目标\n提升前端代码质量和用户体验。', bench: '任务1: 实现一个复杂表单组件' },
};

export function getAgentDefaults(agentId: string) {
  const defaults = AGENT_DEFAULTS[agentId];
  if (!defaults) {
    return {
      skills: ['reasoning', 'self-optimize'],
      mcpServers: [] as MCPServer[],
      autoagent: { enabled: true, programMd: '', benchTasks: '', score: 0, iterations: 0, bestScore: 0, log: [] as OptimizationLogEntry[] },
    };
  }
  return {
    skills: defaults.skills || [],
    mcpServers: (defaults.mcp || []).map(mid => {
      const srv = DEFAULT_MCP_SERVERS.find(s => s.id === mid);
      return srv ? { ...srv, connected: true } : null;
    }).filter(Boolean) as MCPServer[],
    autoagent: {
      enabled: true,
      programMd: defaults.program || '',
      benchTasks: defaults.bench || '',
      score: 0.35 + Math.random() * 0.25,
      iterations: Math.floor(Math.random() * 5),
      bestScore: 0,
      log: [] as OptimizationLogEntry[],
    },
  };
}
