import React from 'react';
import { useStore } from '../../store';
import { ChevronIcon, FileIcon } from '../shared/Icons';

const OutputPage: React.FC = () => {
  const currentCompany = useStore((s) => s.currentCompany);
  const expandedOutputs = useStore((s) => s.expandedOutputs);
  const toggleOutputExpand = useStore((s) => s.toggleOutputExpand);

  const company = currentCompany;
  if (!company) return null;

  const doneTasks = (company.tasks || []).filter((t) => t.status === 'done');

  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><span className="topbar-title">项目产出</span></div>
      </div>
      <div className="content-body">
        <div className="output-page">
          <h2>项目产出</h2>

          {doneTasks.length === 0 ? (
            <div className="empty-state">
              <FileIcon style={{ width: 64, height: 64, marginBottom: 16, opacity: 0.3 }} />
              <p>暂无已完成的任务产出</p>
            </div>
          ) : (
            <div className="output-list">
              {doneTasks.map((task) => {
                const expanded = expandedOutputs[task.id] !== false;
                return (
                  <div key={task.id} className="output-item">
                    <div
                      className={`output-item-header ${expanded ? 'expanded' : ''}`}
                      onClick={() => toggleOutputExpand(task.id)}
                    >
                      <ChevronIcon className="chevron" />
                      <h4>{task.name}</h4>
                      <span className="time">{new Date(task.created).toLocaleDateString('zh-CN')}</span>
                      <span className="status-dot" style={{ background: '#34c759' }} />
                    </div>
                    {expanded && task.outputs && (
                      <div className="output-steps">
                        {task.outputs.map((out, i) => (
                          <div key={i} className="output-step">
                            <div className="output-step-num">{i + 1}</div>
                            <div className="output-step-content">
                              <div className="output-step-title">{out.title}</div>
                              <div className="output-step-text">{out.text}</div>
                              <div className="output-step-meta">
                                <span>角色: {out.agent || '\u2014'}</span>
                                <span>耗时: {out.duration || '\u2014'}</span>
                                <span>Tokens: {out.tokens || '\u2014'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
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

export default OutputPage;
