import React from 'react';
import { DEPT_COLORS, PROVIDERS } from '../../types';
import type { Agent, AgentConfig } from '../../types';
import { SettingsIcon } from '../shared/Icons';
import { useStore } from '../../store';

interface Props {
  agent: Agent;
  isHired: boolean;
  config?: AgentConfig;
  onHire: () => void;
  onConfig: () => void;
  onProfile: () => void;
}

const AgentCard: React.FC<Props> = ({ agent, isHired, config, onHire, onConfig, onProfile }) => {
  // Support custom department colors from company settings
  const currentCompany = useStore ? useStore((s: any) => s.currentCompany) : null;
  const customDeptColor = currentCompany?.customDepts?.find((d: any) => d.name === agent.dept)?.color;
  const color = customDeptColor || DEPT_COLORS[agent.dept] || '#3370ff';

  return (
    <div className="agent-card">
      <div className="agent-card-top">
        <div
          className="agent-card-avatar"
          style={{ background: color, cursor: isHired ? 'pointer' : 'default' }}
          onClick={() => { if (isHired) onProfile(); }}
        >
          {agent.name.charAt(0)}
        </div>
        <div>
          <div
            className="agent-card-name"
            style={{ cursor: isHired ? 'pointer' : 'default' }}
            onClick={() => { if (isHired) onProfile(); }}
          >
            {agent.name}
          </div>
          <div className="agent-card-dept">{agent.dept}</div>
        </div>
      </div>

      <div className="agent-card-desc">{agent.desc}</div>

      <div className="agent-card-tags">
        {agent.tags.map((tag) => (
          <span key={tag} className="agent-tag">{tag}</span>
        ))}
      </div>

      {isHired && config && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {config.provider && (
            <span className="agent-tag" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              {PROVIDERS.find((p) => p.id === config.provider)?.name || config.provider}
            </span>
          )}
          {config.skills && config.skills.length > 0 && (
            <span className="agent-tag" style={{ background: 'rgba(249,115,22,.1)', color: '#f97316' }}>
              {config.skills.length} Skills
            </span>
          )}
          {config.mcpServers && config.mcpServers.length > 0 && (
            <span className="agent-tag" style={{ background: 'rgba(139,92,246,.1)', color: '#8b5cf6' }}>
              {config.mcpServers.length} MCP
            </span>
          )}
          {config.autoagent?.enabled && (
            <span className="agent-tag" style={{ background: 'linear-gradient(135deg,rgba(249,115,22,.1),rgba(236,72,153,.1))', color: '#ec4899' }}>
              自优化
            </span>
          )}
        </div>
      )}

      <div className="agent-card-actions">
        <button
          className={`btn-hire ${isHired ? 'hired' : ''}`}
          onClick={(e) => { e.stopPropagation(); if (!isHired) onHire(); }}
        >
          {isHired ? '\u2713 已聘用' : '聘用'}
        </button>
        {isHired && (
          <button className="btn-config" onClick={(e) => { e.stopPropagation(); onConfig(); }}>
            <SettingsIcon />
          </button>
        )}
      </div>
    </div>
  );
};

export default AgentCard;
