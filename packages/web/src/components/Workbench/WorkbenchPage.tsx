import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import type { DAGNode, TaskDAG, TaskProgressMessage } from '../../store';
import { AGENTS_DB, DEPT_COLORS } from '../../types';
import { RocketIcon } from '../shared/Icons';
import DAGView from './DAGView';
import Modal from '../shared/Modal';
import { getSocket } from '../../services/api';

function timeAgo(ts: number | string): string {
  const time = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  const diff = Date.now() - time;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return Math.floor(diff / 86400000) + '天前';
}

const WorkbenchPage: React.FC = () => {
  const currentCompany = useStore((s) => s.currentCompany);
  const addToast = useStore((s) => s.addToast);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');

  // DAG orchestration state
  const activeDAG = useStore((s) => s.activeDAG);
  const setActiveDAG = useStore((s) => s.setActiveDAG);
  const updateDAGNode = useStore((s) => s.updateDAGNode);
  const taskProgress = useStore((s) => s.taskProgress);
  const addTaskProgress = useStore((s) => s.addTaskProgress);
  const clearTaskProgress = useStore((s) => s.clearTaskProgress);
  const taskLoading = useStore((s) => s.taskLoading);
  const setTaskLoading = useStore((s) => s.setTaskLoading);
  const launchTaskAction = useStore((s) => s.launchTask);
  const serverTasks = useStore((s) => s.serverTasks);
  const loadTasks = useStore((s) => s.loadTasks);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);

  const progressRef = useRef<HTMLDivElement>(null);
  const subscribedTaskRef = useRef<string | null>(null);

  const company = currentCompany;

  // Load task history on mount — MUST be before early return
  useEffect(() => {
    if (!company) return;
    loadTasks();
  }, [company?.id]);

  // Socket.IO subscriptions — MUST be before early return
  useEffect(() => {
    if (!company) return;
    let socket: any;
    try {
      socket = getSocket();
    } catch (err) {
      console.warn('[WorkbenchPage] Failed to init socket:', err);
      return;
    }

    const onDAGUpdate = (dag: TaskDAG) => {
      setActiveDAG(dag);
      if (dag.status === 'done' || dag.status === 'failed') {
        setTaskLoading(false);
        loadTasks();
        if (dag.status === 'done') {
          addToast('任务执行完成！');
        } else {
          addToast('任务执行失败', 'error');
        }
      }
    };

    const onStepUpdate = (data: { taskId: string; node: DAGNode }) => {
      updateDAGNode(data.node);
    };

    const onProgress = (data: TaskProgressMessage) => {
      addTaskProgress(data);
    };

    socket.on('task:dag-update', onDAGUpdate);
    socket.on('task:step-update', onStepUpdate);
    socket.on('task:progress', onProgress);

    return () => {
      socket.off('task:dag-update', onDAGUpdate);
      socket.off('task:step-update', onStepUpdate);
      socket.off('task:progress', onProgress);
      if (subscribedTaskRef.current) {
        socket.emit('task:unsubscribe', subscribedTaskRef.current);
      }
    };
  }, [company]);

  // Auto-scroll progress log — MUST be before early return
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight;
    }
  }, [taskProgress]);

  // Early return AFTER all hooks
  if (!company) return null;

  const handleLaunchTask = async () => {
    const name = taskName.trim();
    if (!name) { addToast('请输入任务名称', 'error'); return; }
    if (company.employees.length === 0) { addToast('没有员工可分配，请先招聘', 'error'); return; }

    setShowTaskModal(false);
    clearTaskProgress();
    setSelectedNodeId(null);

    const socket = getSocket();

    // Unsubscribe from previous task
    if (subscribedTaskRef.current) {
      socket.emit('task:unsubscribe', subscribedTaskRef.current);
    }

    const taskId = await launchTaskAction(name, taskDesc.trim());
    if (taskId) {
      subscribedTaskRef.current = taskId;
      socket.emit('task:subscribe', taskId);
      addToast('任务已发布，AI团队开始协作！');
    }

    setTaskName('');
    setTaskDesc('');
  };

  const selectedNode = activeDAG?.nodes.find((n) => n.id === selectedNodeId);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><span className="topbar-title">工作台</span></div>
      </div>
      <div className="content-body">
        <div className="workbench-page">
          <div className="task-header">
            <h2>任务管理</h2>
            <button className="task-publish-btn" onClick={() => setShowTaskModal(true)} disabled={taskLoading}>
              <RocketIcon /> {taskLoading ? '执行中...' : '发布任务'}
            </button>
          </div>

          {/* Planning indicator */}
          {taskLoading && !activeDAG && (
            <div className="dag-container fade-in" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div className="planning-spinner" />
              <p style={{ marginTop: 16, color: '#8b8fa3', fontSize: 14 }}>正在使用AI分解任务，请稍候...</p>
            </div>
          )}

          {/* Active DAG visualization */}
          {activeDAG && (
            <DAGView dag={activeDAG} onNodeClick={(nodeId) => setSelectedNodeId(nodeId === selectedNodeId ? null : nodeId)} selectedNodeId={selectedNodeId} />
          )}

          {/* Node detail panel */}
          {selectedNode && (
            <div className="node-detail-panel fade-in">
              <div className="node-detail-header">
                <h4>{selectedNode.label}</h4>
                <span className={`node-status-badge ${selectedNode.status}`}>{
                  { pending: '等待中', running: '执行中', done: '已完成', failed: '失败', skipped: '已跳过' }[selectedNode.status]
                }</span>
              </div>
              <div className="node-detail-meta">
                <span>执行者: {selectedNode.agentName}</span>
                {selectedNode.metadata && (
                  <>
                    <span>耗时: {(selectedNode.metadata.duration / 1000).toFixed(1)}s</span>
                    <span>模型: {selectedNode.metadata.model}</span>
                    <span>Tokens: ~{selectedNode.metadata.tokens}</span>
                  </>
                )}
              </div>
              <div className="node-detail-prompt">
                <strong>任务指令:</strong>
                <pre>{selectedNode.taskPrompt}</pre>
              </div>
              {selectedNode.output && (
                <div className="node-detail-output">
                  <strong>输出结果:</strong>
                  <pre>{selectedNode.output}</pre>
                </div>
              )}
              {selectedNode.error && (
                <div className="node-detail-error">
                  <strong>错误信息:</strong>
                  <pre>{selectedNode.error}</pre>
                </div>
              )}
            </div>
          )}

          {/* Progress log */}
          {taskProgress.length > 0 && (
            <div className="task-progress-log" ref={progressRef}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#646a73' }}>执行日志</h3>
              {taskProgress.map((msg, i) => (
                <div key={i} className="progress-entry">
                  <span className="progress-time">{new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className="progress-agent">[{msg.agentName}]</span>
                  <span className="progress-text">{msg.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Task history from server */}
          {serverTasks.length > 0 && (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 16 }}>任务历史</h3>
              <div className="task-list">
                {serverTasks.map((task: any) => {
                  const statusMap: Record<string, string> = { pending: '待执行', running: '执行中', completed: '已完成', failed: '失败' };
                  const iconColors: Record<string, string> = { running: 'rgba(51,112,255,.1)', completed: 'rgba(52,199,89,.1)', failed: 'rgba(255,59,48,.1)', pending: 'rgba(100,106,115,.1)' };
                  const iconC: Record<string, string> = { running: '#3370ff', completed: '#34c759', failed: '#ff3b30', pending: '#646a73' };
                  return (
                    <div key={task.id} className="task-card">
                      <div className="task-card-icon" style={{ background: iconColors[task.status] || iconColors.pending }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconC[task.status] || iconC.pending} strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      </div>
                      <div className="task-card-info">
                        <h4>{task.name}</h4>
                        <p>{task.totalSteps || 0}个步骤 · {task.completedSteps || 0}已完成 · {timeAgo(task.createdAt)}</p>
                      </div>
                      <span className={`task-card-status ${task.status}`}>{statusMap[task.status] || task.status}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty state */}
          {!activeDAG && !taskLoading && serverTasks.length === 0 && (
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
            <button className="btn-primary" onClick={handleLaunchTask}>发布任务</button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default WorkbenchPage;
