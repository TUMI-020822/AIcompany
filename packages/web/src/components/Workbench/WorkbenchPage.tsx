import React, { useState } from 'react';
import { useStore } from '../../store';
import { AGENTS_DB, DEPT_COLORS } from '../../types';
import type { Agent, Task, TaskStep } from '../../types';
import { RocketIcon } from '../shared/Icons';
import DAGView from './DAGView';
import Modal from '../shared/Modal';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return Math.floor(diff / 86400000) + '天前';
}

const WorkbenchPage: React.FC = () => {
  const currentCompany = useStore((s) => s.currentCompany);
  const updateCompany = useStore((s) => s.updateCompany);
  const addToast = useStore((s) => s.addToast);
  const addMessage = useStore((s) => s.addMessage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');

  const company = currentCompany;
  if (!company) return null;

  const tasks = company.tasks || [];
  const activeTask = tasks.find((t) => t.status === 'running');

  const launchTask = () => {
    const name = taskName.trim();
    if (!name) { addToast('请输入任务名称', 'error'); return; }
    const employees = (company.employees || []).map((eid) => AGENTS_DB.find((a) => a.id === eid)).filter(Boolean) as Agent[];
    if (employees.length === 0) { addToast('没有员工可分配', 'error'); return; }

    const steps: TaskStep[] = [];
    const pm = employees.find((a) => a.dept === '产品部');
    const eng = employees.find((a) => a.dept === '工程部');
    const design = employees.find((a) => a.dept === '设计部');
    const market = employees.find((a) => a.dept === '市场部');
    const ops = employees.find((a) => a.dept === '运营部');

    const analyst = pm || employees[0];
    steps.push({ id: 's1', label: '需求分析', agentId: analyst.id, status: 'running' });

    const parallelItems: TaskStep[] = [];
    if (eng) parallelItems.push({ id: 's2a', label: '技术方案', agentId: eng.id, status: 'pending' });
    if (design) parallelItems.push({ id: 's2b', label: '设计方案', agentId: design.id, status: 'pending' });
    if (parallelItems.length === 0 && employees.length > 1) {
      parallelItems.push({ id: 's2a', label: '方案制定', agentId: employees[1].id, status: 'pending' });
    }
    if (parallelItems.length > 0) steps.push({ parallel: true, items: parallelItems });

    const summarizer = market || ops || employees[employees.length - 1];
    if (summarizer && summarizer.id !== analyst.id) {
      steps.push({ id: 's3', label: '策略整合', agentId: summarizer.id, status: 'pending' });
    }
    steps.push({ id: 's4', label: '最终评审', agentId: analyst.id, status: 'pending' });

    const task: Task = {
      id: 'task_' + Date.now(),
      name,
      desc: taskDesc.trim(),
      status: 'running',
      created: Date.now(),
      steps,
      outputs: [],
    };

    const updatedTasks = [task, ...tasks];
    updateCompany({ ...company, tasks: updatedTasks });
    setShowTaskModal(false);
    setTaskName('');
    setTaskDesc('');
    addToast('任务已发布，AI团队开始协作！');

    // Post to group chat
    const chatKey = company.id + '_all';
    addMessage(chatKey, {
      self: false,
      sender: '系统',
      text: `新任务发布：${name}\n\n${taskDesc.trim()}\n\n已自动分配${steps.length}个执行步骤，AI团队开始协作...`,
      color: '#8b5cf6',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    });

    // Simulate DAG execution
    simulateExecution(task, updatedTasks);
  };

  const simulateExecution = (task: Task, allTasks: Task[]) => {
    const flatSteps: TaskStep[] = [];
    task.steps.forEach((s) => {
      if (s.parallel && s.items) s.items.forEach((it) => flatSteps.push(it));
      else flatSteps.push(s);
    });

    let idx = 0;
    const advance = () => {
      if (idx >= flatSteps.length) {
        task.status = 'done';
        task.outputs = flatSteps.map((s) => {
          const agent = AGENTS_DB.find((a) => a.id === s.agentId);
          return {
            title: s.label || '',
            agent: agent?.name || '未知',
            text: `${s.label}分析完成。产出了完整的方案文档。`,
            duration: (3 + Math.random() * 15).toFixed(1) + 's',
            tokens: Math.floor(1000 + Math.random() * 4000),
          };
        });
        updateCompany({ ...company, tasks: allTasks });
        addToast('任务已完成！查看项目产出。');
        return;
      }
      const step = flatSteps[idx];
      step.status = 'running';
      updateCompany({ ...company, tasks: allTasks });

      setTimeout(() => {
        step.status = 'done';
        idx++;
        updateCompany({ ...company, tasks: allTasks });
        advance();
      }, 2500 + Math.random() * 2000);
    };
    advance();
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><span className="topbar-title">工作台</span></div>
      </div>
      <div className="content-body">
        <div className="workbench-page">
          <div className="task-header">
            <h2>任务管理</h2>
            <button className="task-publish-btn" onClick={() => setShowTaskModal(true)}>
              <RocketIcon /> 发布任务
            </button>
          </div>

          {activeTask && <DAGView task={activeTask} />}

          {tasks.length > 0 ? (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>任务历史</h3>
              <div className="task-list">
                {tasks.map((task) => {
                  const iconColors: Record<string, string> = { running: 'rgba(51,112,255,.1)', done: 'rgba(52,199,89,.1)', failed: 'rgba(255,59,48,.1)' };
                  const iconC: Record<string, string> = { running: '#3370ff', done: '#34c759', failed: '#ff3b30' };
                  const statusLabels: Record<string, string> = { running: '执行中', done: '已完成', failed: '失败' };
                  return (
                    <div key={task.id} className="task-card">
                      <div className="task-card-icon" style={{ background: iconColors[task.status] || iconColors.done }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconC[task.status] || iconC.done} strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      </div>
                      <div className="task-card-info">
                        <h4>{task.name}</h4>
                        <p>{task.steps?.length || 0}个步骤 · {timeAgo(task.created)}</p>
                      </div>
                      <span className={`task-card-status ${task.status}`}>{statusLabels[task.status] || task.status}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <RocketIcon style={{ width: 64, height: 64, marginBottom: 16, opacity: 0.3 }} />
              <p>暂无任务，点击上方按钮发布你的第一个任务</p>
            </div>
          )}
        </div>
      </div>

      {showTaskModal && (
        <Modal title="发布任务" description="AI团队将自动分解任务、分配角色、协作完成。" onClose={() => setShowTaskModal(false)} className="task-modal">
          <div className="form-group">
            <label>任务名称</label>
            <input type="text" placeholder="例如：设计一款社交电商App" value={taskName} onChange={(e) => setTaskName(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>任务描述</label>
            <textarea placeholder="详细描述你需要AI团队完成的任务..." value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowTaskModal(false)}>取消</button>
            <button className="btn-primary" onClick={launchTask}>发布任务</button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default WorkbenchPage;
