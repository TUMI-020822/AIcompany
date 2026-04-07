import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { AGENTS_DB, PROVIDERS, AVAILABLE_SKILLS, DEFAULT_MCP_SERVERS } from '../../types';
import type { AgentConfig, MCPServer, OptimizationLogEntry } from '../../types';
import { CloseIcon } from '../shared/Icons';
import * as api from '../../services/api';

const DEFAULT_CONFIG: AgentConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  skills: [],
  mcpServers: [],
  autoagent: { enabled: false, programMd: '', benchTasks: '', score: 0, iterations: 0, bestScore: 0, log: [] },
};

const ConfigModal: React.FC = () => {
  const agentId = useStore((s) => s.configModalAgent);
  const setConfigModalAgent = useStore((s) => s.setConfigModalAgent);
  const currentCompany = useStore((s) => s.currentCompany);
  const catalogAgents = useStore((s) => s.catalogAgents);
  const updateCompany = useStore((s) => s.updateCompany);
  const addToast = useStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<'model' | 'skills' | 'mcp' | 'autoagent'>('model');

  // Deep clone config into local state so we never mutate the store directly
  const [localConfig, setLocalConfig] = useState<AgentConfig>(() => {
    if (!currentCompany || !agentId) return { ...DEFAULT_CONFIG };
    const existing = (currentCompany.employeeConfigs || {})[agentId];
    return existing ? JSON.parse(JSON.stringify(existing)) : { ...DEFAULT_CONFIG };
  });

  // Reset local config when agentId changes
  useEffect(() => {
    if (!currentCompany || !agentId) return;
    const existing = (currentCompany.employeeConfigs || {})[agentId];
    setLocalConfig(existing ? JSON.parse(JSON.stringify(existing)) : { ...DEFAULT_CONFIG });
    setActiveTab('model');
  }, [agentId]);

  // Look up from catalog first, then fall back to AGENTS_DB
  const catalogAgent = catalogAgents.find((a: any) => a.id === agentId);
  const agent = catalogAgent
    ? { id: catalogAgent.id, name: catalogAgent.name, dept: catalogAgent.dept, desc: catalogAgent.description || '', tags: catalogAgent.tags || [], role: catalogAgent.role || '' }
    : AGENTS_DB.find((a) => a.id === agentId);

  // Helper to update nested config — MUST be before early return
  const updateConfig = useCallback((partial: Partial<AgentConfig>) => {
    setLocalConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  // Early returns AFTER all hooks
  if (!agentId || !currentCompany) return null;
  if (!agent) return null;

  const close = () => setConfigModalAgent(null);

  const save = async () => {
    if (!currentCompany || !agentId) return;
    const configs = { ...currentCompany.employeeConfigs };
    configs[agentId] = localConfig;
    try {
      await api.updateAgentConfig(currentCompany.id, agentId, localConfig as any);
    } catch (err) {
      console.error('Failed to save config to server:', err);
    }
    updateCompany({ ...currentCompany, employeeConfigs: configs });
    close();
    addToast(`${agent.name} 配置已保存`);
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
          {activeTab === 'model' && <ModelTab config={localConfig} onChange={updateConfig} />}
          {activeTab === 'skills' && <SkillsTab config={localConfig} onChange={updateConfig} />}
          {activeTab === 'mcp' && <MCPTab config={localConfig} onChange={updateConfig} />}
          {activeTab === 'autoagent' && <AutoAgentTab config={localConfig} onChange={updateConfig} agent={agent} />}
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
const ModelTab: React.FC<{ config: AgentConfig; onChange: (partial: Partial<AgentConfig>) => void }> = ({ config, onChange }) => {
  const [provider, setProvider] = useState(config.provider || 'deepseek');
  const [model, setModel] = useState(config.model || 'deepseek-chat');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [temp, setTemp] = useState(config.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(config.maxTokens || 4096);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || '');
  const [sysPrompt, setSysPrompt] = useState(config.systemPrompt || '');

  const provData = PROVIDERS.find((p) => p.id === provider);
  const models = provData?.models || [];

  const syncToParent = useCallback((updates: Partial<AgentConfig>) => {
    onChange(updates);
  }, [onChange]);

  // Sync all fields to parent whenever they change
  useEffect(() => {
    syncToParent({
      provider,
      model: model || models[0] || '',
      apiKey,
      temperature: temp,
      maxTokens,
      baseUrl,
      systemPrompt: sysPrompt,
    });
  }, [provider, model, apiKey, temp, maxTokens, baseUrl, sysPrompt, syncToParent, models]);

  return (
    <>
      <div className="form-group">
        <label>LLM 供应商</label>
        <div className="provider-grid">
          {PROVIDERS.map((prov) => (
            <div
              key={prov.id}
              className={`provider-option ${provider === prov.id ? 'selected' : ''}`}
              onClick={() => {
                setProvider(prov.id);
                setModel(prov.models[0] || '');
              }}
            >
              {prov.name}
            </div>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>模型</label>
        <select value={model || models[0]} onChange={(e) => setModel(e.target.value)}>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      {(provider === 'custom' || provider === 'ollama') && (
        <div className="form-group">
          <label>Base URL</label>
          <input type="text" placeholder="https://api.example.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>
      )}
      {provData?.needsKey && (
        <div className="form-group">
          <label>API Key</label>
          <input type="password" placeholder="sk-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>
      )}
      <div className="form-group">
        <label>Temperature: {temp}</label>
        <input type="range" min="0" max="2" step="0.1" value={temp} onChange={(e) => setTemp(parseFloat(e.target.value))} style={{ width: '100%' }} />
      </div>
      <div className="form-group">
        <label>Max Tokens</label>
        <input type="number" placeholder="4096" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)} />
      </div>
      <div className="form-group">
        <label>自定义 System Prompt（留空使用角色默认）</label>
        <textarea placeholder="自定义系统提示词..." value={sysPrompt} onChange={(e) => setSysPrompt(e.target.value)} style={{ minHeight: 60 }} />
      </div>
    </>
  );
};

// === SKILLS TAB ===
const SkillsTab: React.FC<{ config: AgentConfig; onChange: (partial: Partial<AgentConfig>) => void }> = ({ config, onChange }) => {
  const [skills, setSkills] = useState<string[]>([...(config.skills || [])]);
  const [serverSkills, setServerSkills] = useState<any[]>([]);

  useEffect(() => {
    api.getSkills().then(setServerSkills).catch(() => {});
  }, []);

  const toggleSkill = (skillId: string) => {
    const next = skills.includes(skillId) ? skills.filter((s) => s !== skillId) : [...skills, skillId];
    setSkills(next);
    onChange({ skills: next });
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
const MCPTab: React.FC<{ config: AgentConfig; onChange: (partial: Partial<AgentConfig>) => void }> = ({ config, onChange }) => {
  const [servers, setServers] = useState<MCPServer[]>([...(config.mcpServers || [])]);
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

  const syncServers = useCallback((updated: MCPServer[]) => {
    setServers(updated);
    onChange({ mcpServers: updated });
  }, [onChange]);

  const removeServer = (idx: number) => {
    syncServers(servers.filter((_, i) => i !== idx));
  };

  const addPreset = (srv: MCPServer) => {
    if (servers.some((s) => s.id === srv.id)) return;
    syncServers([...servers, { ...srv, connected: false, status: serverStatuses[srv.id] || 'stopped' }]);
  };

  const connectServer = useCallback(async (serverId: string) => {
    setLoading((p) => ({ ...p, [serverId]: true }));
    try {
      const result = await api.startMCPServer(serverId);
      setServerStatuses((p) => ({ ...p, [serverId]: result.status || 'running' }));
      setServers((prev) => {
        const updated = prev.map((s) => s.id === serverId ? { ...s, connected: true, status: 'running' } : s);
        onChange({ mcpServers: updated });
        return updated;
      });
      addToast(`MCP ${serverId} connected`);
    } catch (err: any) {
      addToast(`Failed to start ${serverId}: ${err.message}`, 'error');
      setServerStatuses((p) => ({ ...p, [serverId]: 'error' }));
    } finally {
      setLoading((p) => ({ ...p, [serverId]: false }));
    }
  }, [addToast, onChange]);

  const disconnectServer = useCallback(async (serverId: string) => {
    setLoading((p) => ({ ...p, [serverId]: true }));
    try {
      await api.stopMCPServer(serverId);
      setServerStatuses((p) => ({ ...p, [serverId]: 'stopped' }));
      setServers((prev) => {
        const updated = prev.map((s) => s.id === serverId ? { ...s, connected: false, status: 'stopped' } : s);
        onChange({ mcpServers: updated });
        return updated;
      });
      addToast(`MCP ${serverId} disconnected`);
    } catch (err: any) {
      addToast(`Failed to stop ${serverId}: ${err.message}`, 'error');
    } finally {
      setLoading((p) => ({ ...p, [serverId]: false }));
    }
  }, [addToast, onChange]);

  return (
    <>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
        连接 MCP 服务器，让员工使用外部工具
      </label>
      <div className="mcp-server-list">
        {servers.length === 0 && (
          <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>暂未连接任何 MCP 服务器</div>
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
                <div className="mcp-server-tools">工具: {(srv.tools || []).join(', ')}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {isRunning ? (
                  <button
                    style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    disabled={isLoading}
                    onClick={() => disconnectServer(srv.id)}
                  >
                    {isLoading ? '...' : '断开'}
                  </button>
                ) : (
                  <button
                    style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--accent)', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--accent)' }}
                    disabled={isLoading}
                    onClick={() => connectServer(srv.id)}
                  >
                    {isLoading ? '...' : '连接'}
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
                {isAdded ? '✓ 已添加' : '+ 添加'}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

// === AUTOAGENT TAB ===
const AutoAgentTab: React.FC<{ config: AgentConfig; onChange: (partial: Partial<AgentConfig>) => void; agent: { name: string; tags: string[] } }> = ({ config, agent, onChange }) => {
  const aa = config.autoagent || { enabled: false, programMd: '', benchTasks: '', score: 0, iterations: 0, bestScore: 0, log: [] };
  const [enabled, setEnabled] = useState(aa.enabled);
  const [programMd, setProgramMd] = useState(aa.programMd || `# ${agent.name} 优化指令\n\n## 目标\n提升「${agent.tags.join('、')}」相关任务的完成质量。`);
  const [benchTasks, setBenchTasks] = useState(aa.benchTasks || `任务1: 针对"${agent.tags[0] || '通用'}"场景，给出专业分析报告`);
  const [logLines, setLogLines] = useState<OptimizationLogEntry[]>([...(aa.log || [])]);
  const [optimizing, setOptimizing] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const addToast = useStore((s) => s.addToast);

  const syncAA = useCallback(() => {
    onChange({
      autoagent: { enabled, programMd, benchTasks, log: logLines, score: aa.score || 0, iterations: aa.iterations || 0, bestScore: aa.bestScore || 0 }
    });
  }, [enabled, programMd, benchTasks, logLines, aa.score, aa.iterations, aa.bestScore, onChange]);

  useEffect(() => {
    syncAA();
  }, [syncAA]);

  // Listen for real-time optimization progress via Socket.IO
  useEffect(() => {
    let socket: any;
    try {
      socket = api.getSocket();
    } catch (err) {
      console.warn('[AutoAgentTab] Failed to initialize socket, skipping event listeners:', err);
      return;
    }

    const handleProgress = (data: any) => {
      if (data.type === 'complete') {
        setOptimizing(false);
        if (data.result) {
          setLogLines((prev) => {
            // Update aa fields via state
            return prev;
          });
        }
      }
      if (data.message) {
        const newLine: OptimizationLogEntry = {
          text: data.message,
          type: data.type === 'iteration_result'
            ? (data.kept ? 'score' : '')
            : data.type === 'complete' || data.type === 'baseline' ? 'highlight' : '',
        };
        setLogLines((prev) => [...prev, newLine]);
      }
    };

    socket.on('autoagent:progress', handleProgress);
    return () => {
      try {
        socket.off('autoagent:progress', handleProgress);
      } catch (e) { /* ignore cleanup errors */ }
    };
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  const startOptimize = async () => {
    if (!config.provider) {
      addToast('请先配置 LLM 供应商和 API Key', 'error');
      return;
    }

    setOptimizing(true);
    const lines = [...logLines];
    lines.push({ text: `启动优化 ${agent.name}...`, type: 'highlight' });
    setLogLines(lines);

    try {
      await api.startOptimization({
        agentId: agent.name,
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
    } catch (err: any) {
      setOptimizing(false);
      lines.push({ text: `优化失败: ${err.message}`, type: 'highlight' });
      setLogLines(lines);
      addToast(`优化失败: ${err.message}`, 'error');
    }
  };

  const handleReset = () => {
    setLogLines([]);
    setEnabled(false);
    onChange({
      autoagent: { enabled: false, programMd: '', benchTasks: '', score: 0, iterations: 0, bestScore: 0, log: [] }
    });
  };

  const displayScore = (aa.score && typeof aa.score === 'number') ? aa.score : 0;
  const displayIterations = (aa.iterations && typeof aa.iterations === 'number') ? aa.iterations : 0;
  const displayBestScore = (aa.bestScore && typeof aa.bestScore === 'number') ? aa.bestScore : 0;

  return (
    <div className="autoagent-section">
      <div className="autoagent-card">
        <h4>自我优化引擎 <span className="badge-new">AutoAgent</span></h4>
        <p>基于 AutoAgent 理念：给 Agent 一个目标，让它自动迭代优化自己的 System Prompt、工具配置和编排策略。</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>启用自优化</span>
          <div className={`skill-item-toggle ${enabled ? 'on' : ''}`} onClick={() => setEnabled(!enabled)} />
        </div>
        <div className="autoagent-metrics">
          {[
            { val: displayScore.toFixed(2), label: '当前评分' },
            { val: String(displayIterations), label: '迭代次数' },
            { val: displayBestScore > 0 ? displayBestScore.toFixed(2) : '—', label: '最高评分' },
          ].map((m, i) => (
            <div key={i} className="autoagent-metric">
              <div className="val">{m.val}</div>
              <div className="label">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="score-bar-container">
          <div className="score-bar" style={{ width: `${Math.min(displayScore * 100, 100)}%` }} />
        </div>
      </div>

      <div className="autoagent-card">
        <h4>Program.md 指令</h4>
        <p>定义优化目标和约束条件。Meta-Agent 将根据此指令自动调整配置。</p>
        <textarea className="program-md-editor" value={programMd} onChange={(e) => setProgramMd(e.target.value)} />
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
            {optimizing ? '优化中...' : '▶ 启动优化循环'}
          </button>
          <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: 12 }} onClick={handleReset}>
            重置
          </button>
        </div>
      </div>

      <div className="autoagent-card">
        <h4>基准测试任务</h4>
        <p>定义评估任务，Meta-Agent 在每次迭代后运行这些任务来评分。</p>
        <textarea className="program-md-editor" style={{ minHeight: 60 }} value={benchTasks} onChange={(e) => setBenchTasks(e.target.value)} />
      </div>
    </div>
  );
};

export default ConfigModal;
