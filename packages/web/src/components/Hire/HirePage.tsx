import React from 'react';
import { useStore } from '../../store';
import { AGENTS_DB, DEPT_COLORS, PROVIDERS, getAgentDefaults } from '../../types';
import type { Agent } from '../../types';
import AgentCard from './AgentCard';

const HirePage: React.FC = () => {
  const currentCompany = useStore((s) => s.currentCompany);
  const updateCompany = useStore((s) => s.updateCompany);
  const hireDeptFilter = useStore((s) => s.hireDeptFilter);
  const setHireDeptFilter = useStore((s) => s.setHireDeptFilter);
  const addToast = useStore((s) => s.addToast);
  const setConfigModalAgent = useStore((s) => s.setConfigModalAgent);
  const setProfileDrawerAgent = useStore((s) => s.setProfileDrawerAgent);

  const company = currentCompany;
  if (!company) return null;

  const allDeptKeys = Object.keys(DEPT_COLORS);
  (company.customDepts || []).forEach((cd) => {
    if (!allDeptKeys.includes(cd.name)) allDeptKeys.push(cd.name);
  });
  const depts = ['全部', ...allDeptKeys];

  const filtered = hireDeptFilter === '全部'
    ? AGENTS_DB
    : AGENTS_DB.filter((a) => a.dept === hireDeptFilter);

  const handleHire = (agent: Agent) => {
    const employees = [...(company.employees || []), agent.id];
    const configs = { ...company.employeeConfigs };
    if (!configs[agent.id]) {
      const defs = getAgentDefaults(agent.id);
      configs[agent.id] = {
        provider: 'deepseek',
        model: 'deepseek-chat',
        skills: defs.skills,
        mcpServers: defs.mcpServers,
        autoagent: defs.autoagent,
      };
    }
    updateCompany({ ...company, employees, employeeConfigs: configs });
    addToast(`${agent.name} 已加入公司！已自动配置 Skills、MCP 和自优化。`);
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
                从187+专业角色中选择，组建你的AI团队。已聘用 {(company.employees || []).length} 人。
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
