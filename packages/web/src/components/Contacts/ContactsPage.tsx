import React from 'react';
import { useStore } from '../../store';
import { AGENTS_DB, DEPT_COLORS, PROVIDERS } from '../../types';
import type { Agent } from '../../types';
import { ChevronIcon, ContactsIcon } from '../shared/Icons';

const ContactsPage: React.FC = () => {
  const currentCompany = useStore((s) => s.currentCompany);
  const expandedDepts = useStore((s) => s.expandedDepts);
  const toggleDeptExpand = useStore((s) => s.toggleDeptExpand);
  const setProfileDrawerAgent = useStore((s) => s.setProfileDrawerAgent);

  const company = currentCompany;
  if (!company) return null;

  const employees = (company.employees || [])
    .map((eid) => AGENTS_DB.find((a) => a.id === eid))
    .filter(Boolean) as Agent[];

  const grouped: Record<string, Agent[]> = {};
  employees.forEach((agent) => {
    if (!grouped[agent.dept]) grouped[agent.dept] = [];
    grouped[agent.dept].push(agent);
  });

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
    </>
  );
};

export default ContactsPage;
