import React, { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { AGENTS_DB, DEPT_COLORS, PROVIDERS, AVAILABLE_SKILLS } from '../../types';
import type { Agent } from '../../types';
import { CloseIcon, SearchIcon } from '../shared/Icons';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '\u521A\u521A';
  if (diff < 3600000) return Math.floor(diff / 60000) + '\u5206\u949F\u524D';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '\u5C0F\u65F6\u524D';
  return Math.floor(diff / 86400000) + '\u5929\u524D';
}

const AgentProfileDrawer: React.FC = () => {
  const agentId = useStore((s) => s.profileDrawerAgent);
  const setProfileDrawerAgent = useStore((s) => s.setProfileDrawerAgent);
  const currentCompany = useStore((s) => s.currentCompany);
  const catalogAgents = useStore((s) => s.catalogAgents);
  const setCurrentChat = useStore((s) => s.setCurrentChat);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const setConfigModalAgent = useStore((s) => s.setConfigModalAgent);
  const messages = useStore((s) => s.messages);
  const [searchQuery, setSearchQuery] = useState('');

  if (!agentId || !currentCompany) return null;

  // Look up from catalog first, then fall back to AGENTS_DB
  const catalogAgent = catalogAgents.find((a: any) => a.id === agentId);
  const agent: Agent | undefined = catalogAgent
    ? { id: catalogAgent.id, name: catalogAgent.name, dept: catalogAgent.dept, desc: catalogAgent.description || '', tags: catalogAgent.tags || [], role: catalogAgent.role || '' }
    : AGENTS_DB.find((a) => a.id === agentId);
  if (!agent) return null;

  const cfg = (currentCompany.employeeConfigs || {})[agentId] || {} as any;
  const aa = cfg.autoagent || {};

  const close = () => setProfileDrawerAgent(null);

  const goToChat = () => {
    close();
    setCurrentChat('agent_' + agentId);
    setCurrentPage('chat');
  };

  const openConfig = () => {
    close();
    setConfigModalAgent(agentId);
  };

  // Token usage (simulated)
  const totalTokens = useMemo(() => Math.floor(3000 + Math.random() * 25000), [agentId]);
  const inputTokens = Math.floor(totalTokens * 0.6);
  const outputTokens = totalTokens - inputTokens;

  // Count messages
  let msgCount = 0;
  Object.entries(messages).forEach(([key, msgs]) => {
    if (key.startsWith(currentCompany.id)) {
      msgCount += msgs.filter((m) => m.sender === agent.name).length;
    }
  });

  // Search chat results
  const chatResults = useMemo(() => {
    const results: { sender: string; text: string; time: string }[] = [];
    Object.entries(messages).forEach(([key, msgs]) => {
      if (!key.startsWith(currentCompany.id)) return;
      msgs.forEach((m) => {
        if (m.sender === agent.name) {
          if (!searchQuery || m.text.toLowerCase().includes(searchQuery.toLowerCase())) {
            results.push(m);
          }
        }
      });
    });
    return results.slice(-10).reverse();
  }, [messages, currentCompany.id, agent.name, searchQuery]);

  const providerData = PROVIDERS.find((p) => p.id === (cfg.provider || 'deepseek'));

  // Timeline items from tasks
  const timelineItems = useMemo(() => {
    const items: { icon: string; title: string; desc: string; time: number }[] = [];
    (currentCompany.tasks || []).forEach((task) => {
      const flatSteps: any[] = [];
      (task.steps || []).forEach((s: any) => {
        if (s.parallel && s.items) s.items.forEach((it: any) => flatSteps.push(it));
        else flatSteps.push(s);
      });
      flatSteps.forEach((step) => {
        if (step.agentId === agentId) {
          items.push({
            icon: step.status === 'done' ? '\u2705' : step.status === 'running' ? '\u{1F504}' : '\u23F3',
            title: `${task.name} \u2014 ${step.label}`,
            desc: `${step.status === 'done' ? '已完成' : '进行中'}`,
            time: task.created,
          });
        }
      });
    });
    return items.slice(0, 8);
  }, [currentCompany.tasks, agentId]);

  return (
    <>
      <div className="profile-overlay" onClick={close} />
      <div className="profile-drawer">
        {/* Header */}
        <div className="profile-header">
          <div className="profile-close" onClick={close}><CloseIcon /></div>
          <div className="profile-identity">
            <div className="profile-avatar" style={{ background: DEPT_COLORS[agent.dept] || '#3370ff' }}>
              {agent.name.charAt(0)}
            </div>
            <div className="profile-name-area">
              <h3>{agent.name}</h3>
              <div className="dept">{agent.dept} · {agent.role}</div>
            </div>
          </div>
          <div className="profile-status-bar">
            <div className="profile-status-chip" style={{ background: 'rgba(52,199,89,.2)', color: '#6ee7a0' }}>
              <span className="dot" style={{ background: 'var(--success)' }} />空闲
            </div>
            {aa.enabled && (
              <div className="profile-status-chip" style={{ background: 'rgba(249,115,22,.2)', color: '#fbbf7a' }}>
                <span className="dot" style={{ background: '#f97316' }} />自优化
              </div>
            )}
            {cfg.mcpServers && cfg.mcpServers.length > 0 && (
              <div className="profile-status-chip" style={{ background: 'rgba(139,92,246,.2)', color: '#b5a3f7' }}>
                {cfg.mcpServers.length} MCP
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="profile-body">
          {/* Metrics */}
          <div className="profile-section">
            <div className="profile-section-title">运行指标</div>
            <div className="profile-metrics">
              {[
                { value: totalTokens.toLocaleString(), label: '总 Token 用量', sub: `输入 ${inputTokens.toLocaleString()} / 输出 ${outputTokens.toLocaleString()}`, color: 'var(--accent)' },
                { value: '0', label: '已完成任务', sub: '累计参与', color: 'var(--success)' },
                { value: String(msgCount), label: '对话消息数', sub: '发出的消息', color: '#f5a623' },
                { value: aa.score ? aa.score.toFixed(2) : '\u2014', label: '自优化评分', sub: aa.iterations ? `${aa.iterations} 次迭代` : '未启动', color: '#ec4899' },
              ].map((m, i) => (
                <div key={i} className="profile-metric-card">
                  <div className="value" style={{ color: m.color }}>{m.value}</div>
                  <div className="label">{m.label}</div>
                  <div className="sub">{m.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Config */}
          <div className="profile-section">
            <div className="profile-section-title">模型配置</div>
            {[
              { k: 'LLM 供应商', v: providerData?.name || cfg.provider || '未配置' },
              { k: '模型', v: cfg.model || '默认' },
              { k: 'Temperature', v: String(cfg.temperature ?? 0.7) },
              { k: 'Max Tokens', v: String(cfg.maxTokens || 4096) },
            ].map((kv, i) => (
              <div key={i} className="profile-kv">
                <span className="k">{kv.k}</span>
                <span className="v">{kv.v}</span>
              </div>
            ))}
          </div>

          {/* Skills */}
          <div className="profile-section">
            <div className="profile-section-title">技能 Skills ({(cfg.skills || []).length})</div>
            <div className="profile-tags">
              {(cfg.skills || []).map((sid: string) => {
                const sk = AVAILABLE_SKILLS.find((s) => s.id === sid);
                return sk ? <span key={sid} className="profile-tag skill">{sk.icon} {sk.name}</span> : null;
              })}
              {(!cfg.skills || cfg.skills.length === 0) && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>暂无技能</span>
              )}
            </div>
          </div>

          {/* MCP */}
          <div className="profile-section">
            <div className="profile-section-title">MCP 服务器 ({(cfg.mcpServers || []).length})</div>
            <div className="profile-tags">
              {(cfg.mcpServers || []).map((srv: any, i: number) => (
                <span key={i} className="profile-tag mcp">{srv.name} ({srv.tools?.length || 0})</span>
              ))}
              {(!cfg.mcpServers || cfg.mcpServers.length === 0) && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>暂无 MCP 连接</span>
              )}
            </div>
          </div>

          {/* AutoAgent */}
          {(aa.enabled || aa.score) && (
            <div className="profile-section">
              <div className="profile-section-title">
                自优化 AutoAgent
                <span style={{ fontSize: 10, padding: '2px 6px', background: 'linear-gradient(135deg,#f97316,#ec4899)', color: '#fff', borderRadius: 8, fontWeight: 600, marginLeft: 4 }}>ON</span>
              </div>
              {[
                { k: '状态', v: aa.enabled ? '已启用' : '未启用' },
                { k: '当前评分', v: aa.score ? aa.score.toFixed(3) : '\u2014' },
                { k: '最高评分', v: aa.bestScore ? aa.bestScore.toFixed(3) : '\u2014' },
                { k: '累计迭代', v: (aa.iterations || 0) + ' 次' },
              ].map((kv, i) => (
                <div key={i} className="profile-kv">
                  <span className="k">{kv.k}</span><span className="v">{kv.v}</span>
                </div>
              ))}
              {aa.score > 0 && (
                <div className="score-bar-container" style={{ marginTop: 8 }}>
                  <div className="score-bar" style={{ width: `${aa.score * 100}%` }} />
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="profile-section">
            <div className="profile-section-title">近期工作</div>
            <div className="profile-timeline">
              {timelineItems.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>暂无工作记录</div>
              ) : (
                timelineItems.map((item, i) => (
                  <div key={i} className="profile-tl-item">
                    <div className="profile-tl-dot">{item.icon}</div>
                    <div className="profile-tl-content">
                      <div className="profile-tl-title">{item.title}</div>
                      <div className="profile-tl-desc">{item.desc}</div>
                      <div className="profile-tl-time">{timeAgo(item.time)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat History Search */}
          <div className="profile-section">
            <div className="profile-section-title">聊天记录搜索</div>
            <div className="profile-chat-search">
              <SearchIcon />
              <input
                type="text"
                placeholder={`搜索 ${agent.name} 的聊天记录...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="profile-chat-results">
              {chatResults.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0', textAlign: 'center' }}>
                  {searchQuery ? '未找到匹配记录' : '暂无聊天记录'}
                </div>
              ) : (
                chatResults.map((m, i) => (
                  <div key={i} className="profile-chat-result" onClick={goToChat}>
                    <div className="sender">{m.sender}</div>
                    <div className="text">{m.text}</div>
                    <div className="time">{m.time}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="profile-actions">
          <button className="btn-primary" onClick={goToChat}>发送消息</button>
          <button className="btn-secondary" onClick={openConfig}>编辑配置</button>
        </div>
      </div>
    </>
  );
};

export default AgentProfileDrawer;
