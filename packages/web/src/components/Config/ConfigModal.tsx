import React, { useState, useRef } from 'react';
import { useStore } from '../../store';
import { AGENTS_DB, PROVIDERS, AVAILABLE_SKILLS, DEFAULT_MCP_SERVERS } from '../../types';
import type { AgentConfig, MCPServer, OptimizationLogEntry } from '../../types';
import { CloseIcon } from '../shared/Icons';
import * as api from '../../services/api';

/* placeholder - skeleton with tab switching */
const ConfigModal: React.FC = () => {
  const agentId = useStore((s) => s.configModalAgent);
  const setConfigModalAgent = useStore((s) => s.setConfigModalAgent);
  const currentCompany = useStore((s) => s.currentCompany);
  const catalogAgents = useStore((s) => s.catalogAgents);
  const updateCompany = useStore((s) => s.updateCompany);
  const addToast = useStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<'model' | 'skills' | 'mcp' | 'autoagent'>('model');

  if (!agentId || !currentCompany) return null;

  // Look up from catalog first, then fall back to AGENTS_DB
  const catalogAgent = catalogAgents.find((a: any) => a.id === agentId);
  const agent = catalogAgent
    ? { id: catalogAgent.id, name: catalogAgent.name, dept: catalogAgent.dept, desc: catalogAgent.description || '', tags: catalogAgent.tags || [], role: catalogAgent.role || '' }
    : AGENTS_DB.find((a) => a.id === agentId);
  if (!agent) return null;

  const configs = { ...currentCompany.employeeConfigs };
  const config: AgentConfig = configs[agentId] || {
    provider: 'deepseek', model: 'deepseek-chat', skills: [], mcpServers: [], autoagent: { enabled: false, programMd: '', benchTasks: '', score: 0, iterations: 0, bestScore: 0, log: [] },
  };

  const close = () => setConfigModalAgent(null);

  const save = async () => {
    configs[agentId] = config;
    // Save to backend
    try {
      await api.updateAgentConfig(currentCompany.id, agentId, config as any);
    } catch (err) {
      console.error('Failed to save config to server:', err);
    }
    updateCompany({ ...currentCompany, employeeConfigs: configs });
    close();
    addToast(`${agent.name} \u914D\u7F6E\u5DF2\u4FDD\u5B58`);
  };

  const tabs = [
    { id: 'model' as const, label: '模型配置' },
    { id: 'skills' as const, label: '技能 Skills' },
    { id: 'mcp' as const, label: 'MCP 服务器' },
    { id: 'autoagent' as const, label: '自优化 AutoAgent' },
  ];

  return (
    <div className="modal-overlay config-modal" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" style={{ width: 600 }}>
        <h2>配置 {agent.name}</h2>
        <p className="desc">{agent.dept} · {agent.desc}</p>

        <div className="config-tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`config-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </div>
          ))}
        </div>

        <div className="config-tab-content active">
          {activeTab === 'model' && <ModelTab config={config} />}
          {activeTab === 'skills' && <SkillsTab config={config} />}
          {activeTab === 'mcp' && <MCPTab config={config} />}
          {activeTab === 'autoagent' && <AutoAgentTab config={config} agent={agent} />}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={close}>取消</button>
          <button className="btn-primary" onClick={save}>保存全部配置</button>
        </div>
      </div>
    </div>
  );
};

// === MODEL TAB ===
const ModelTab: React.FC<{ config: AgentConfig }> = ({ config }) => {
  const [provider, setProvider] = useState(config.provider || 'deepseek');
  const [model, setModel] = useState(config.model || '');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [temp, setTemp] = useState(config.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(config.maxTokens || 4096);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || '');
  const [sysPrompt, setSysPrompt] = useState(config.systemPrompt || '');

  const provData = PROVIDERS.find((p) => p.id === provider);
  const models = provData?.models || [];

  // Sync back to config object
  config.provider = provider;
  config.model = model || models[0] || '';
  config.apiKey = apiKey;
  config.temperature = temp;
  config.maxTokens = maxTokens;
  config.baseUrl = baseUrl;
  config.systemPrompt = sysPrompt;

  return (
    <>
      <div className="form-group">
        <label>LLM 供应商</label>
        <div className="provider-grid">
          {PROVIDERS.map((prov) => (
            <div
              key={prov.id}
              className={`provider-option ${provider === prov.id ? 'selected' : ''}`}
              onClick={() => { setProvider(prov.id); config.provider = prov.id; setModel(prov.models[0]); }}
            >
              {prov.name}
            </div>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>模型</label>
        <select value={model || models[0]} onChange={(e) => { setModel(e.target.value); config.model = e.target.value; }}>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      {(provider === 'custom' || provider === 'ollama') && (
        <div className="form-group">
          <label>Base URL</label>
          <input type="text" placeholder="https://api.example.com/v1" value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); config.baseUrl = e.target.value; }} />
        </div>
      )}
      {provData?.needsKey && (
        <div className="form-group">
          <label>API Key</label>
          <input type="password" placeholder="sk-..." value={apiKey} onChange={(e) => { setApiKey(e.target.value); config.apiKey = e.target.value; }} />
        </div>
      )}
      <div className="form-group">
        <label>Temperature: {temp}</label>
        <input type="range" min="0" max="2" step="0.1" value={temp} onChange={(e) => { const v = parseFloat(e.target.value); setTemp(v); config.temperature = v; }} style={{ width: '100%' }} />
      </div>
      <div className="form-group">
        <label>Max Tokens</label>
        <input type="number" placeholder="4096" value={maxTokens} onChange={(e) => { const v = parseInt(e.target.value) || 4096; setMaxTokens(v); config.maxTokens = v; }} />
      </div>
      <div className="form-group">
        <label>自定义 System Prompt（留空使用角色默认）</label>
        <textarea placeholder="自定义系统提示词..." value={sysPrompt} onChange={(e) => { setSysPrompt(e.target.value); config.systemPrompt = e.target.value; }} style={{ minHeight: 60 }} />
      </div>
    </>
  );
};

// === SKILLS TAB ===
const SkillsTab: React.FC<{ config: AgentConfig }> = ({ config }) => {
  const [skills, setSkills] = useState<string[]>([...config.skills]);

  const toggleSkill = (skillId: string) => {
    const next = skills.includes(skillId) ? skills.filter((s) => s !== skillId) : [...skills, skillId];
    setSkills(next);
    config.skills = next;
  };

  const categories: Record<string, typeof AVAILABLE_SKILLS> = {};
  AVAILABLE_SKILLS.forEach((s) => {
    if (!categories[s.category]) categories[s.category] = [];
    categories[s.category].push(s);
  });

  return (
    <>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
        为该员工启用技能，增强其能力范围
      </label>
      {Object.entries(categories).map(([cat, catSkills]) => (
        <React.Fragment key={cat}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cat}</div>
          <div className="skills-list">
            {catSkills.map((skill) => {
              const isOn = skills.includes(skill.id);
              return (
                <div key={skill.id} className="skill-item">
                  <div className="skill-item-icon">{skill.icon}</div>
                  <div className="skill-item-info">
                    <div className="skill-item-name">{skill.name}</div>
                    <div className="skill-item-desc">{skill.desc}</div>
                  </div>
                  <div className={`skill-item-toggle ${isOn ? 'on' : ''}`} onClick={() => toggleSkill(skill.id)} />
                </div>
              );
            })}
          </div>
        </React.Fragment>
      ))}
    </>
  );
};

// === MCP TAB ===
const MCPTab: React.FC<{ config: AgentConfig }> = ({ config }) => {
  const [servers, setServers] = useState<MCPServer[]>([...config.mcpServers]);

  const removeServer = (idx: number) => {
    const next = servers.filter((_, i) => i !== idx);
    setServers(next);
    config.mcpServers = next;
  };

  const addPreset = (srv: MCPServer) => {
    if (servers.some((s) => s.id === srv.id)) return;
    const next = [...servers, { ...srv, connected: true }];
    setServers(next);
    config.mcpServers = next;
  };

  return (
    <>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
        连接 MCP 服务器，让员工使用外部工具
      </label>
      <div className="mcp-server-list">
        {servers.length === 0 && (
          <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>暂未连接任何 MCP 服务器</div>
        )}
        {servers.map((srv, i) => (
          <div key={srv.id + i} className="mcp-server-item">
            <div className="dot" style={{ background: srv.connected ? 'var(--success)' : 'var(--warning)' }} />
            <div style={{ flex: 1 }}>
              <div className="mcp-server-name">{srv.name}</div>
              <div className="mcp-server-tools">工具: {(srv.tools || []).join(', ')}</div>
            </div>
            <div className="mcp-server-remove" onClick={() => removeServer(i)}>
              <CloseIcon />
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10, marginTop: 16 }}>可用 MCP 服务器</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
        {DEFAULT_MCP_SERVERS.map((srv) => {
          const isAdded = servers.some((s) => s.id === srv.id);
          return (
            <div
              key={srv.id}
              style={{
                padding: 10,
                border: `1.5px solid ${isAdded ? 'var(--success)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: isAdded ? 'default' : 'pointer',
                background: isAdded ? 'rgba(52,199,89,.04)' : 'transparent',
                transition: 'all .15s',
              }}
              onClick={() => addPreset(srv)}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{srv.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{srv.tools.length} 个工具</div>
              <div style={{ fontSize: 11, color: isAdded ? 'var(--success)' : 'var(--accent)', marginTop: 4, fontWeight: 600 }}>
                {isAdded ? '\u2713 已添加' : '+ 添加'}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

// === AUTOAGENT TAB ===
const AutoAgentTab: React.FC<{ config: AgentConfig; agent: { name: string; tags: string[] } }> = ({ config, agent }) => {
  const aa = config.autoagent;
  const [enabled, setEnabled] = useState(aa.enabled);
  const [programMd, setProgramMd] = useState(aa.programMd || `# ${agent.name} 优化指令\n\n## 目标\n提升「${agent.tags.join('、')}」相关任务的完成质量。`);
  const [benchTasks, setBenchTasks] = useState(aa.benchTasks || `任务1: 针对"${agent.tags[0] || '通用'}"场景，给出专业分析报告`);
  const [logLines, setLogLines] = useState<OptimizationLogEntry[]>(aa.log || []);
  const [optimizing, setOptimizing] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  aa.enabled = enabled;
  aa.programMd = programMd;
  aa.benchTasks = benchTasks;
  aa.log = logLines;

  const startOptimize = () => {
    setOptimizing(true);
    let iter = 0;
    const maxIter = 5;
    let currentScore = aa.score || 0.3 + Math.random() * 0.2;
    const lines = [...logLines];

    lines.push({ text: `启动优化 ${agent.name}...`, type: 'highlight' });
    lines.push({ text: `  基线评分: ${currentScore.toFixed(3)}` });
    setLogLines([...lines]);

    const actions = ['调整 system prompt 中的角色定位描述', '优化输出格式约束', '增加 Chain-of-Thought 推理步骤', '添加领域知识示例', '调整 temperature 参数'];

    const doIter = () => {
      if (iter >= maxIter) {
        lines.push({ text: `优化完成！最终评分: ${currentScore.toFixed(3)}`, type: 'highlight' });
        setLogLines([...lines]);
        aa.score = currentScore;
        aa.bestScore = Math.max(aa.bestScore || 0, currentScore);
        aa.iterations = (aa.iterations || 0) + maxIter;
        setOptimizing(false);
        return;
      }
      iter++;
      const action = actions[Math.floor(Math.random() * actions.length)];
      const delta = (Math.random() - 0.3) * 0.08;
      const newScore = Math.min(0.98, Math.max(0.1, currentScore + delta));
      const kept = newScore >= currentScore;

      lines.push({ text: `[迭代 ${iter}] ${action}` });
      setLogLines([...lines]);

      setTimeout(() => {
        lines.push({ text: `  \u2192 评分: ${newScore.toFixed(3)} (${delta >= 0 ? '+' : ''}${delta.toFixed(3)}) ${kept ? '\u2713 保留' : '\u2717 回滚'}`, type: kept ? 'score' : '' });
        setLogLines([...lines]);
        if (kept) currentScore = newScore;
        setTimeout(doIter, 600);
      }, 800);
    };

    setTimeout(doIter, 800);
  };

  return (
    <div className="autoagent-section">
      <div className="autoagent-card">
        <h4>自我优化引擎 <span className="badge-new">AutoAgent</span></h4>
        <p>基于 AutoAgent 理念：给 Agent 一个目标，让它自动迭代优化自己的 System Prompt、工具配置和编排策略。</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>启用自优化</span>
          <div className={`skill-item-toggle ${enabled ? 'on' : ''}`} onClick={() => { setEnabled(!enabled); aa.enabled = !enabled; }} />
        </div>
        <div className="autoagent-metrics">
          {[
            { val: (aa.score || 0).toFixed(2), label: '当前评分' },
            { val: String(aa.iterations || 0), label: '迭代次数' },
            { val: aa.bestScore ? aa.bestScore.toFixed(2) : '\u2014', label: '最高评分' },
          ].map((m, i) => (
            <div key={i} className="autoagent-metric">
              <div className="val">{m.val}</div>
              <div className="label">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="score-bar-container">
          <div className="score-bar" style={{ width: `${(aa.score || 0) * 100}%` }} />
        </div>
      </div>

      <div className="autoagent-card">
        <h4>Program.md 指令</h4>
        <p>定义优化目标和约束条件。Meta-Agent 将根据此指令自动调整配置。</p>
        <textarea className="program-md-editor" value={programMd} onChange={(e) => { setProgramMd(e.target.value); aa.programMd = e.target.value; }} />
      </div>

      <div className="autoagent-card">
        <h4>优化日志</h4>
        <div className="optimization-log" ref={logRef}>
          {logLines.length === 0 ? (
            <div className="line">等待启动优化...</div>
          ) : (
            logLines.map((l, i) => <div key={i} className={`line ${l.type || ''}`}>{l.text}</div>)
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn-optimize" disabled={optimizing} onClick={startOptimize}>
            {optimizing ? '优化中...' : '\u25B6 启动优化循环'}
          </button>
          <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => { setLogLines([]); aa.score = 0; aa.iterations = 0; aa.bestScore = 0; aa.log = []; }}>
            重置
          </button>
        </div>
      </div>

      <div className="autoagent-card">
        <h4>基准测试任务</h4>
        <p>定义评估任务，Meta-Agent 在每次迭代后运行这些任务来评分。</p>
        <textarea className="program-md-editor" style={{ minHeight: 60 }} value={benchTasks} onChange={(e) => { setBenchTasks(e.target.value); aa.benchTasks = e.target.value; }} />
      </div>
    </div>
  );
};

export default ConfigModal;
