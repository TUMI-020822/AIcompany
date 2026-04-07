import React, { useState } from 'react';
import { useStore } from '../../store';
import { DEPT_COLORS, PROVIDERS } from '../../types';
import type { Agent } from '../../types';
import { ChevronIcon, ContactsIcon } from '../shared/Icons';
import * as api from '../../services/api';

const ContactsPage: React.FC = () => {
  const currentCompany = useStore((s) => s.currentCompany);
  const catalogAgents = useStore((s) => s.catalogAgents);
  const expandedDepts = useStore((s) => s.expandedDepts);
  const toggleDeptExpand = useStore((s) => s.toggleDeptExpand);
  const setProfileDrawerAgent = useStore((s) => s.setProfileDrawerAgent);
  const updateCompany = useStore((s) => s.updateCompany);
  const addToast = useStore((s) => s.addToast);
  const [fireTarget, setFireTarget] = useState<string | null>(null);
  const [firing, setFiring] = useState(false);

  const company = currentCompany;
  if (!company) return null;

  // Build agent lookup from catalog
  const agentMap: Record<string, Agent> = {};
  catalogAgents.forEach((a: any) => {
    agentMap[a.id] = {
      id: a.id,
      name: a.name,
      dept: a.dept,
      desc: a.description || a.desc || '',
      tags: a.tags || [],
      role: a.role || '',
    };
  });

  const employees = (company.employees || [])
    .map((eid) => agentMap[eid])
    .filter(Boolean) as Agent[];

  const grouped: Record<string, Agent[]> = {};
  employees.forEach((agent) => {
    if (!grouped[agent.dept]) grouped[agent.dept] = [];
    grouped[agent.dept].push(agent);
  });

  const handleFire = async (agent: Agent) => {
    if (!currentCompany || firing) return;
    setFiring(true);
    try {
      await api.fireAgent(currentCompany.id, agent.id);
      const updatedEmployees = currentCompany.employees.filter(id => id !== agent.id);
      const updatedConfigs = { ...currentCompany.employeeConfigs };
      delete updatedConfigs[agent.id];
      updateCompany({
        ...currentCompany,
        employees: updatedEmployees,
        employeeConfigs: updatedConfigs
      });
      addToast(`已解雇 ${agent.name}`, 'warning');
    } catch (err: any) {
      addToast(`解雇失败: ${err.message}`, 'error');
    } finally {
      setFiring(false);
      setFireTarget(null);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><span className="topbar-title">通讯录</span></div>
      </div>
      <div className="content-body">
        <div className="contacts-page">
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>组织架构</h2>

          {Object.keys(grouped).length === 0 ? (
            <div className="empty-state">
              <ContactsIcon style={{ width: 64, height: 64, marginBottom: 16, opacity: 0.3 }} />
              <p>暂无员工，先去招聘中心聘用AI员工</p>
            </div>
          ) : (
            <div className="org-tree">
              {Object.entries(grouped).map(([dept, agents]) => {
                const expanded = expandedDepts[dept] !== false;
                return (
                  <div key={dept} className="org-dept">
                    <div
                      className={`org-dept-header ${expanded ? 'expanded' : ''}`}
                      onClick={() => toggleDeptExpand(dept)}
                    >
                      <ChevronIcon />
                      <h4>{dept}</h4>
                      <span className="count">{agents.length}人</span>
                    </div>
                    {expanded && (
                      <div className="org-members">
                        {agents.map((agent) => {
                          const cfg = (company.employeeConfigs || {})[agent.id];
                          const roleText = cfg?.provider
                            ? (PROVIDERS.find((p) => p.id === cfg.provider)?.name || '') +
                              (cfg.skills?.length ? ` \u00B7 ${cfg.skills.length} Skills` : '')
                            : (agent.tags[0] || '');
                          return (
                            <div
                              key={agent.id}
                              className="org-member"
                              onClick={() => setProfileDrawerAgent(agent.id)}
                            >
                              <div
                                className="org-member-avatar"
                                style={{ background: DEPT_COLORS[agent.dept] || '#3370ff' }}
                              >
                                {agent.name.charAt(0)}
                              </div>
                              <span className="org-member-name">{agent.name}</span>
                              <span className="org-member-role">{roleText}</span>
                              <div className="org-member-status" />
                              <div
                                className="org-member-fire"
                                onClick={(e) => { e.stopPropagation(); setFireTarget(agent.id); }}
                                title="解雇"
                              >✕</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 解雇确认对话框 */}
      {fireTarget && (() => {
        const targetAgent = employees.find(a => a.id === fireTarget);
        if (!targetAgent) return null;
        return (
          <div className="fire-confirm-overlay" onClick={() => setFireTarget(null)}>
            <div className="fire-confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>确认解雇</h3>
              <p>确定要解雇 <strong>{targetAgent.name}</strong> 吗？</p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>此操作将移除该员工的所有配置和对话记录。</p>
              <div className="fire-confirm-actions">
                <button className="btn-secondary" onClick={() => setFireTarget(null)}>取消</button>
                <button className="btn-danger" onClick={() => handleFire(targetAgent)} style={{ background: '#ff3b30', color: '#fff' }} disabled={firing}>
                  {firing ? '处理中...' : '确认解雇'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default ContactsPage;
