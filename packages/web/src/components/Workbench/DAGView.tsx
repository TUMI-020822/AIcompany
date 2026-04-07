import React from 'react';
import { AGENTS_DB, DEPT_COLORS } from '../../types';
import type { Task, TaskStep } from '../../types';
import { ArrowIcon } from '../shared/Icons';
import { useStore } from '../../store';

interface Props {
  task: Task;
}

const DAGNode: React.FC<{ step: TaskStep }> = ({ step }) => {
  const setProfileDrawerAgent = useStore((s) => s.setProfileDrawerAgent);
  const agent = AGENTS_DB.find((a) => a.id === step.agentId);
  const statusClass = step.status || 'pending';
  const dotColors: Record<string, string> = { pending: '#dee0e3', running: '#3370ff', done: '#34c759', waiting: '#f5a623' };
  const statusText: Record<string, string> = { pending: '等待中', running: '执行中', done: '已完成', waiting: '等待审批' };

  return (
    <div
      className="dag-node"
      style={{ cursor: 'pointer' }}
      onClick={() => { if (agent) setProfileDrawerAgent(step.agentId!); }}
    >
      <div className={`dag-node-box ${statusClass}`}>
        <div
          className="dag-node-avatar"
          style={{ background: DEPT_COLORS[agent?.dept || ''] || '#3370ff' }}
        >
          {(agent?.name || '?').charAt(0)}
        </div>
        <div className="dag-node-name">{step.label || agent?.name || '未知'}</div>
        <div className="dag-node-status">
          <span className="dot" style={{ background: dotColors[statusClass] || '#dee0e3' }} />
          {statusText[statusClass] || ''}
        </div>
      </div>
    </div>
  );
};

const DAGView: React.FC<Props> = ({ task }) => {
  const steps = task.steps || [];

  return (
    <div className="dag-container fade-in">
      <div className="dag-title">
        <span className="dot" />
        {'任务进行中：' + task.name}
      </div>
      <div className="dag-graph">
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            {step.parallel && step.items ? (
              <div className="dag-parallel">
                {step.items.map((item, j) => (
                  <DAGNode key={j} step={item} />
                ))}
              </div>
            ) : (
              <DAGNode step={step} />
            )}
            {i < steps.length - 1 && (
              <div className={`dag-arrow ${
                step.parallel
                  ? (step.items?.some((it) => it.status === 'done') ? 'active' : '')
                  : (step.status === 'done' ? 'active' : '')
              }`}>
                <ArrowIcon />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default DAGView;
