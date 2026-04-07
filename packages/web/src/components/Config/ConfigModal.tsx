import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { AGENTS_DB, PROVIDERS, AVAILABLE_SKILLS, DEFAULT_MCP_SERVERS } from '../../types';
import type { AgentConfig, MCPServer, OptimizationLogEntry } from '../../types';
import { CloseIcon } from '../shared/Icons';
import * as api from '../../services/api';

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
    { id: 'model' as const, label: '\u6A21\u578B\u914D\u7F6E' },
    { id: 'skills' as const, label: '\u6280\u80FD Skills' },
    { id: 'mcp' as const, label: 'MCP \u670D\u52A1\u5668' },
    { id: 'autoagent' as const, label: '\u81EA\u4F18\u5316 AutoAgent' },
  ];

  return (
    <div className="modal-overlay config-modal" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" style={{ width: 600 }}>
        <h2>\u914D\u7F6E {agent.name}</h2>
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
          <button className="btn-secondary" onClick={close}>\u53D6\u6D88</button>
          <button className="btn-primary" onClick={save}>\u4FDD\u5B58\u5168\u90E8\u914D\u7F6E</button>
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
        <label>LLM \u4F9B\u5E94\u5546</label>
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
        <label>\u6A21\u578B</label>
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
        <label>\u81EA\u5B9A\u4E49 System Prompt\uFF08\u7559\u7A7A\u4F7F\u7528\u89D2\u8272\u9ED8\u8BA4\uFF09</label>
        <textarea placeholder="\u81EA\u5B9A\u4E49\u7CFB\u7EDF\u63D0\u793A\u8BCD..." value={sysPrompt} onChange={(e) => { setSysPrompt(e.target.value); config.systemPrompt = e.target.value; }} style={{ minHeight: 60 }} />
      </div>
    </>
  );
};

// === SKILLS TAB ===
const SkillsTab: React.FC<{ config: AgentConfig }> = ({ config }) => {
  const [skills, setSkills] = useState<string[]>([...config.skills]);
  const [serverSkills, setServerSkills] = useState<any[]>([]);

  useEffect(() => {
    api.getSkills().then(setServerSkills).catch(() => {});
  }, []);

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
        \u4E3A\u8BE5\u5458\u5DE5\u542F\u7528\u6280\u80FD\uFF0C\u589E\u5F3A\u5176\u80FD\u529B\u8303\u56F4
        {serverSkills.length > 0 && <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 11, color: 'var(--success)' }}>({serverSkills.length} skills available on server)</span>}
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
  const [serverStatuses, setServerStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const addToast = useStore((s) => s.addToast);

  // Fetch real server statuses on mount
  useEffect(() => {
    api.getMCPServers()
      .then((srvList: any[]) => {
        const statuses: Record<string, string> = {};
        srvList.forEach((s: any) => { statuses[s.id] = s.status || 'stopped'; });
        setServerStatuses(statuses);
      })
      .catch(() => {});
  }, []);

  const removeServer = (idx: number) => {
    const next = servers.filter((_, i) => i !== idx);
    setServers(next);
    config.mcpServers = next;
  };

  const addPreset = (srv: MCPServer) => {
    if (servers.some((s) => s.id === srv.id)) return;
    const next = [...servers, { ...srv, connected: false, status: serverStatuses[srv.id] || 'stopped' }];
    setServers(next);
    config.mcpServers = next;
  };

  const connectServer = useCallback(async (serverId: string) => {
    setLoading((p) => ({ ...p, [serverId]: true }));
    try {
      const result = await api.startMCPServer(serverId);
      setServerStatuses((p) => ({ ...p, [serverId]: result.status || 'running' }));
      setServers((prev) => {
        const updated = prev.map((s) => s.id === serverId ? { ...s, connected: true, status: 'running' } : s);
        config.mcpServers = updated;
        return updated;
      });
      addToast(`MCP ${serverId} connected`);
    } catch (err: any) {
      addToast(`Failed to start ${serverId}: ${err.message}`, 'error');
      setServerStatuses((p) => ({ ...p, [serverId]: 'error' }));
    } finally {
      setLoading((p) => ({ ...p, [serverId]: false }));
    }
  }, [addToast, config]);

  const disconnectServer = useCallback(async (serverId: string) => {
    setLoading((p) => ({ ...p, [serverId]: true }));
    try {
      await api.stopMCPServer(serverId);
      setServerStatuses((p) => ({ ...p, [serverId]: 'stopped' }));
      setServers((prev) => {
        const updated = prev.map((s) => s.id === serverId ? { ...s, connected: false, status: 'stopped' } : s);
        config.mcpServers = updated;
        return updated;
      });
      addToast(`MCP ${serverId} disconnected`);
    } catch (err: any) {
      addToast(`Failed to stop ${serverId}: ${err.message}`, 'error');
    } finally {
      setLoading((p) => ({ ...p, [serverId]: false }));
    }
  }, [addToast, config]);

  return (
    <>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
        \u8FDE\u63A5 MCP \u670D\u52A1\u5668\uFF0C\u8BA9\u5458\u5DE5\u4F7F\u7528\u5916\u90E8\u5DE5\u5177
      </label>
      <div className="mcp-server-list">
        {servers.length === 0 && (
          <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>\u6682\u672A\u8FDE\u63A5\u4EFB\u4F55 MCP \u670D\u52A1\u5668</div>
        )}
        {servers.map((srv, i) => {
          const realStatus = serverStatuses[srv.id] || srv.status || 'stopped';
          const isRunning = realStatus === 'running';
          const isLoading = loading[srv.id] || false;
          return (
            <div key={srv.id + i} className="mcp-server-item">
              <div className="dot" style={{ background: isRunning ? 'var(--success)' : realStatus === 'error' ? 'var(--error, #ff3b30)' : 'var(--warning)' }} />
              <div style={{ flex: 1 }}>
                <div className="mcp-server-name">{srv.name} <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({realStatus})</span></div>
                <div className="mcp-server-tools">\u5DE5\u5177: {(srv.tools || []).join(', ')}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {isRunning ? (
                  <button
                    style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    disabled={isLoading}
                    onClick={() => disconnectServer(srv.id)}
                  >
                    {isLoading ? '...' : '\u65AD\u5F00'}
                  </button>
                ) : (
                  <button
                    style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--accent)', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--accent)' }}
                    disabled={isLoading}
                    onClick={() => connectServer(srv.id)}
                  >
                    {isLoading ? '...' : '\u8FDE\u63A5'}
                  </button>
                )}
                <div className="mcp-server-remove" onClick={() => removeServer(i)}>
                  <CloseIcon />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10, marginTop: 16 }}>\u53EF\u7528 MCP \u670D\u52A1\u5668</div>
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
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{srv.tools.length} \u4E2A\u5DE5\u5177</div>
              <div style={{ fontSize: 11, color: isAdded ? 'var(--success)' : 'var(--accent)', marginTop: 4, fontWeight: 600 }}>
                {isAdded ? '\u2713 \u5DF2\u6DFB\u52A0' : '+ \u6DFB\u52A0'}
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
  const [programMd, setProgramMd] = useState(aa.programMd || `# ${agent.name} \u4F18\u5316\u6307\u4EE4\n\n## \u76EE\u6807\n\u63D0\u5347\u300C${agent.tags.join('\u3001')}\u300D\u76F8\u5173\u4EFB\u52A1\u7684\u5B8C\u6210\u8D28\u91CF\u3002`);
  const [benchTasks, setBenchTasks] = useState(aa.benchTasks || `\u4EFB\u52A11: \u9488\u5BF9"${agent.tags[0] || '\u901A\u7528'}"\u573A\u666F\uFF0C\u7ED9\u51FA\u4E13\u4E1A\u5206\u6790\u62A5\u544A`);
  const [logLines, setLogLines] = useState<OptimizationLogEntry[]>(aa.log || []);
  const [optimizing, setOptimizing] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const addToast = useStore((s) => s.addToast);

  aa.enabled = enabled;
  aa.programMd = programMd;
  aa.benchTasks = benchTasks;
  aa.log = logLines;

  // Listen for real-time optimization progress via Socket.IO
  useEffect(() => {
    const socket = api.getSocket();
    const agentId = config.provider ? undefined : undefined; // We listen globally

    const handleProgress = (data: any) => {
      if (data.type === 'complete') {
        setOptimizing(false);
        if (data.result) {
          aa.score = data.result.finalScore || 0;
          aa.bestScore = data.result.bestScore || 0;
          aa.iterations = (aa.iterations || 0) + (data.result.totalIterations || 0);
        }
      }
      if (data.message) {
        const newLine: OptimizationLogEntry = {
          text: data.message,
          type: data.type === 'iteration_result'
            ? (data.kept ? 'score' : '')
            : data.type === 'complete' || data.type === 'baseline' ? 'highlight' : '',
        };
        setLogLines((prev) => {
          const next = [...prev, newLine];
          aa.log = next;
          return next;
        });
      }
    };

    socket.on('autoagent:progress', handleProgress);
    return () => { socket.off('autoagent:progress', handleProgress); };
  }, [aa]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  const startOptimize = async () => {
    if (!config.provider) {
      addToast('\u8BF7\u5148\u914D\u7F6E LLM \u4F9B\u5E94\u5546\u548C API Key', 'error');
      return;
    }

    setOptimizing(true);
    const lines = [...logLines];
    lines.push({ text: `\u542F\u52A8\u4F18\u5316 ${agent.name}...`, type: 'highlight' });
    setLogLines([...lines]);
    aa.log = lines;

    try {
      await api.startOptimization({
        agentId: (config as any).agentId || agent.name,
        agentName: agent.name,
        systemPrompt: config.systemPrompt || '',
        programMd,
        benchmarkTasks: benchTasks,
        iterations: 3,
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      });
      // Real-time updates will come via Socket.IO
    } catch (err: any) {
      setOptimizing(false);
      lines.push({ text: `\u4F18\u5316\u5931\u8D25: ${err.message}`, type: 'highlight' });
      setLogLines([...lines]);
      addToast(`\u4F18\u5316\u5931\u8D25: ${err.message}`, 'error');
    }
  };

  return (
    <div className="autoagent-section">
      <div className="autoagent-card">
        <h4>\u81EA\u6211\u4F18\u5316\u5F15\u64CE <span className="badge-new">AutoAgent</span></h4>
        <p>\u57FA\u4E8E AutoAgent \u7406\u5FF5\uFF1A\u7ED9 Agent \u4E00\u4E2A\u76EE\u6807\uFF0C\u8BA9\u5B83\u81EA\u52A8\u8FED\u4EE3\u4F18\u5316\u81EA\u5DF1\u7684 System Prompt\u3001\u5DE5\u5177\u914D\u7F6E\u548C\u7F16\u6392\u7B56\u7565\u3002</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>\u542F\u7528\u81EA\u4F18\u5316</span>
          <div className={`skill-item-toggle ${enabled ? 'on' : ''}`} onClick={() => { setEnabled(!enabled); aa.enabled = !enabled; }} />
        </div>
        <div className="autoagent-metrics">
          {[
            { val: (aa.score || 0).toFixed(2), label: '\u5F53\u524D\u8BC4\u5206' },
            { val: String(aa.iterations || 0), label: '\u8FED\u4EE3\u6B21\u6570' },
            { val: aa.bestScore ? aa.bestScore.toFixed(2) : '\u2014', label: '\u6700\u9AD8\u8BC4\u5206' },
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
        <h4>Program.md \u6307\u4EE4</h4>
        <p>\u5B9A\u4E49\u4F18\u5316\u76EE\u6807\u548C\u7EA6\u675F\u6761\u4EF6\u3002Meta-Agent \u5C06\u6839\u636E\u6B64\u6307\u4EE4\u81EA\u52A8\u8C03\u6574\u914D\u7F6E\u3002</p>
        <textarea className="program-md-editor" value={programMd} onChange={(e) => { setProgramMd(e.target.value); aa.programMd = e.target.value; }} />
      </div>

      <div className="autoagent-card">
        <h4>\u4F18\u5316\u65E5\u5FD7</h4>
        <div className="optimization-log" ref={logRef}>
          {logLines.length === 0 ? (
            <div className="line">\u7B49\u5F85\u542F\u52A8\u4F18\u5316...</div>
          ) : (
            logLines.map((l, i) => <div key={i} className={`line ${l.type || ''}`}>{l.text}</div>)
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn-optimize" disabled={optimizing} onClick={startOptimize}>
            {optimizing ? '\u4F18\u5316\u4E2D...' : '\u25B6 \u542F\u52A8\u4F18\u5316\u5FAA\u73AF'}
          </button>
          <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => { setLogLines([]); aa.score = 0; aa.iterations = 0; aa.bestScore = 0; aa.log = []; }}>
            \u91CD\u7F6E
          </button>
        </div>
      </div>

      <div className="autoagent-card">
        <h4>\u57FA\u51C6\u6D4B\u8BD5\u4EFB\u52A1</h4>
        <p>\u5B9A\u4E49\u8BC4\u4F30\u4EFB\u52A1\uFF0CMeta-Agent \u5728\u6BCF\u6B21\u8FED\u4EE3\u540E\u8FD0\u884C\u8FD9\u4E9B\u4EFB\u52A1\u6765\u8BC4\u5206\u3002</p>
        <textarea className="program-md-editor" style={{ minHeight: 60 }} value={benchTasks} onChange={(e) => { setBenchTasks(e.target.value); aa.benchTasks = e.target.value; }} />
      </div>
    </div>
  );
};

export default ConfigModal;
