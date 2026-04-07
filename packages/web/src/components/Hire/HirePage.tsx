import React, { useState } from 'react';
import { useStore } from '../../store';
import { DEPT_COLORS, PROVIDERS } from '../../types';
import type { Agent } from '../../types';
import AgentCard from './AgentCard';
import * as api from '../../services/api';

const HirePage: React.FC = () => {
  const currentCompany = useStore((s) => s.currentCompany);
  const updateCompany = useStore((s) => s.updateCompany);
  const catalogAgents = useStore((s) => s.catalogAgents);
  const hireDeptFilter = useStore((s) => s.hireDeptFilter);
  const setHireDeptFilter = useStore((s) => s.setHireDeptFilter);
  const addToast = useStore((s) => s.addToast);
  const setConfigModalAgent = useStore((s) => s.setConfigModalAgent);
  const setProfileDrawerAgent = useStore((s) => s.setProfileDrawerAgent);
  const [hiringId, setHiringId] = useState<string | null>(null);

  const company = currentCompany;
  if (!company) return null;

  // Build agent list from server catalog
  const agents: Agent[] = catalogAgents.map((a: any) => ({
    id: a.id,
    name: a.name,
    dept: a.dept,
    desc: a.description || a.desc || '',
    tags: a.tags || [],
    role: a.role || '',
  }));

  const allDeptKeys = [...new Set(agents.map((a) => a.dept))];
  (company.customDepts || []).forEach((cd) => {
    if (!allDeptKeys.includes(cd.name)) allDeptKeys.push(cd.name);
  });
  const depts = ['\u5168\u90E8', ...allDeptKeys];

  const filtered = hireDeptFilter === '\u5168\u90E8'
    ? agents
    : agents.filter((a) => a.dept === hireDeptFilter);

  const handleHire = async (agent: Agent) => {
    if (hiringId) return;
    setHiringId(agent.id);
    try {
      await api.hireAgent(company.id, agent.id);
      // Update local state
      const employees = [...(company.employees || []), agent.id];
      const configs = { ...company.employeeConfigs };
      if (!configs[agent.id]) {
        configs[agent.id] = {
          provider: 'deepseek',
          model: 'deepseek-chat',
          skills: [],
          mcpServers: [],
          autoagent: { enabled: false, programMd: '', benchTasks: '', score: 0, iterations: 0, bestScore: 0, log: [] },
        };
      }
      updateCompany({ ...company, employees, employeeConfigs: configs });
      addToast(`${agent.name} \u5DF2\u52A0\u5165\u516C\u53F8\uFF01`);
    } catch (err: any) {
      if (err.message?.includes('409')) {
        addToast(`${agent.name} \u5DF2\u7ECF\u88AB\u805A\u7528`, 'error');
      } else {
        addToast(`\u805A\u7528\u5931\u8D25: ${err.message}`, 'error');
      }
    } finally {
      setHiringId(null);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><span className="topbar-title">招聘中心</span></div>
      </div>
      <div className="content-body">
        <div className="recruit-page">
          <div className="recruit-header">
            <h2>AI员工招聘中心</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <p style={{ margin: 0 }}>
                从{agents.length}+专业角色中选择，组建你的AI团队。已聘用 {(company.employees || []).length} 人。
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ fontSize: 13, padding: '7px 14px' }}>+ 新建部门</button>
                <button className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}>+ 自定义员工</button>
              </div>
            </div>
          </div>

          <div className="dept-tabs">
            {depts.map((dept) => (
              <button
                key={dept}
                className={`dept-tab ${hireDeptFilter === dept ? 'active' : ''}`}
                onClick={() => setHireDeptFilter(dept)}
              >
                {dept}
              </button>
            ))}
          </div>

          <div className="agents-grid">
            {filtered.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isHired={(company.employees || []).includes(agent.id)}
                config={(company.employeeConfigs || {})[agent.id]}
                onHire={() => handleHire(agent)}
                onConfig={() => setConfigModalAgent(agent.id)}
                onProfile={() => setProfileDrawerAgent(agent.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default HirePage;
