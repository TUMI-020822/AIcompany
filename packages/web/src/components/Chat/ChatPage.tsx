import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store';
import { AGENTS_DB, DEPT_COLORS } from '../../types';
import type { Agent, Conversation, Message } from '../../types';
import { SearchIcon, SendIcon, HireIcon, SettingsIcon } from '../shared/Icons';
import MessageBubble from './MessageBubble';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return Math.floor(diff / 86400000) + '天前';
}

const DEPT_RESPONSES: Record<string, string[]> = {
  '产品部': [
    '收到，我来从产品角度分析一下这个需求。首先需要明确目标用户群体和核心场景，然后梳理功能优先级。我建议先做MVP验证，按P0/P1/P2划分需求优先级。',
    '这个方向很有潜力。我初步梳理了用户故事地图，建议先围绕核心链路做深度打磨。',
  ],
  '工程部': [
    '从技术实现角度评估了一下，建议采用微服务架构。预计需要3个核心服务模块，我先出架构设计文档。',
    '技术方案我初步评估了可行性。有几个关键技术选型需要讨论。',
  ],
  '设计部': [
    '设计侧我来负责。先做用户调研和竞品UI分析，输出设计规范和组件库。预计本周内可以交付低保真原型。',
  ],
  '市场部': ['营销策略我来制定。先做目标人群画像，然后规划内容矩阵和渠道策略。'],
  '数据部': ['数据分析体系我来搭建。首先确定核心指标框架，然后设计数据埋点方案和看板。'],
  '运营部': ['项目管理我来统筹。我会创建项目计划，设置里程碑和关键节点。'],
  '战略部': ['从行业趋势看，这个方向正处于上升期。我会产出市场分析报告。'],
  '法务部': ['法务合规方面我来把关。需要关注用户数据隐私和平台责任条款。'],
  'HR部': ['团队组建方面我来协助。根据项目需求，我建议团队架构和能力矩阵。'],
  '创意部': ['创意方向我来头脑风暴。从叙事角度，我们可以构建一个引人入胜的品牌故事。'],
};

const ChatPage: React.FC = () => {
  const currentCompany = useStore((s) => s.currentCompany);
  const updateCompany = useStore((s) => s.updateCompany);
  const currentChat = useStore((s) => s.currentChat);
  const setCurrentChat = useStore((s) => s.setCurrentChat);
  const messages = useStore((s) => s.messages);
  const addMessage = useStore((s) => s.addMessage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const setProfileDrawerAgent = useStore((s) => s.setProfileDrawerAgent);
  const [inputText, setInputText] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const company = currentCompany;
  if (!company) return null;
  const employees = (company.employees || [])
    .map((eid) => AGENTS_DB.find((a) => a.id === eid))
    .filter(Boolean) as Agent[];

  // Build chat list
  const chats: Conversation[] = [];
  if (employees.length > 0) {
    chats.push({ id: 'all', name: '全体群聊', type: 'group', preview: '点击开始与AI团队对话', time: Date.now(), unread: 3, color: '#3370ff' });
    const depts = [...new Set(employees.map((a) => a.dept))];
    depts.forEach((dept) => {
      chats.push({ id: 'dept_' + dept, name: dept + '群', type: 'dept', dept, preview: '部门协作频道', time: Date.now() - 60000, color: DEPT_COLORS[dept] || '#3370ff' });
    });
    employees.forEach((agent) => {
      chats.push({ id: 'agent_' + agent.id, name: agent.name, type: 'agent', agent, preview: agent.desc.slice(0, 20) + '...', time: Date.now() - 120000, color: DEPT_COLORS[agent.dept] || '#3370ff' });
    });
  }

  const activeChat = currentChat || (chats.length > 0 ? chats[0].id : null);
  useEffect(() => {
    if (!currentChat && chats.length > 0) {
      setCurrentChat(chats[0].id);
    }
  }, [currentChat, chats.length, setCurrentChat]);

  const chatKey = company.id + '_' + activeChat;
  const currentMessages = messages[chatKey] || [];
  const activeChatData = chats.find((c) => c.id === activeChat);

  // Scroll to bottom
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [currentMessages.length]);

  const simulateResponse = useCallback((key: string, chatId: string, userText: string) => {
    let respondents: Agent[] = [];
    if (chatId === 'all') {
      respondents = employees.slice(0, Math.min(3, employees.length));
    } else if (chatId.startsWith('dept_')) {
      const dept = chatId.replace('dept_', '');
      respondents = employees.filter((a) => a.dept === dept).slice(0, 2);
    } else if (chatId.startsWith('agent_')) {
      const aid = chatId.replace('agent_', '');
      const agent = employees.find((a) => a.id === aid);
      if (agent) respondents = [agent];
    }

    respondents.forEach((agent, i) => {
      setTimeout(() => {
        const deptResps = DEPT_RESPONSES[agent.dept] || ['收到任务，我会从我的专业角度进行分析和执行。'];
        let text: string;
        if (userText.includes('进度') || userText.includes('汇报')) {
          text = `【${agent.name}进度汇报】\n当前任务进展顺利。已完成约60%的工作量。\n\n已完成：基础框架搭建\n进行中：细节优化\n待开始：最终测试`;
        } else {
          text = deptResps[Math.floor(Math.random() * deptResps.length)];
        }
        addMessage(key, {
          self: false,
          sender: agent.name,
          text,
          color: DEPT_COLORS[agent.dept],
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        });
      }, 800 + i * 1500);
    });
  }, [employees, addMessage]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !activeChat) return;
    addMessage(chatKey, {
      self: true,
      text,
      sender: '我',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    });
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    simulateResponse(chatKey, activeChat, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // Empty state
  if (employees.length === 0) {
    return (
      <>
        <div className="topbar">
          <div className="topbar-left"><span className="topbar-title">消息</span></div>
        </div>
        <div className="content-body">
          <div className="empty-state" style={{ flex: 1 }}>
            <HireIcon style={{ width: 64, height: 64, marginBottom: 16, opacity: 0.3 }} />
            <p>还没有员工，先去招聘中心聘用AI员工吧</p>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setCurrentPage('hire')}>
              去招聘
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><span className="topbar-title">消息</span></div>
        <div className="topbar-right">
          <button className="topbar-btn"><SettingsIcon /></button>
        </div>
      </div>
      <div className="content-body">
        {/* Chat list */}
        <div className="chat-list">
          <div className="chat-list-header"><h3>对话</h3></div>
          <div className="chat-search">
            <SearchIcon />
            <input type="text" placeholder="搜索..." />
          </div>
          <div className="chat-items">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${activeChat === chat.id ? 'active' : ''}`}
                onClick={() => setCurrentChat(chat.id)}
              >
                <div
                  className="chat-item-avatar"
                  style={{ background: chat.color, cursor: chat.type === 'agent' ? 'pointer' : 'default' }}
                  onClick={(e) => {
                    if (chat.type === 'agent' && chat.agent) {
                      e.stopPropagation();
                      setProfileDrawerAgent(chat.agent.id);
                    }
                  }}
                >
                  {chat.name.charAt(0)}
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-name">{chat.name}</div>
                  <div className="chat-item-preview">{chat.preview}</div>
                </div>
                <div className="chat-item-meta">
                  <span className="chat-item-time">{timeAgo(chat.time)}</span>
                  {chat.unread && <span className="chat-item-unread">{chat.unread}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="chat-area">
          <div className="chat-header">
            <div className="chat-header-info">
              <h4
                style={{ cursor: activeChatData?.type === 'agent' ? 'pointer' : 'default' }}
                onClick={() => { if (activeChatData?.agent) setProfileDrawerAgent(activeChatData.agent.id); }}
              >
                {activeChatData?.name || '对话'}
              </h4>
              {activeChatData?.type === 'group' && <span>{employees.length}位成员</span>}
            </div>
          </div>

          <div className="chat-messages" ref={messagesRef}>
            {currentMessages.length === 0 && (
              <div className="msg msg-system">
                <div className="msg-bubble">
                  {activeChatData?.type === 'group'
                    ? '欢迎来到全体群聊，发送消息或任务指令开始协作'
                    : `与 ${activeChatData?.name || 'AI'} 开始对话`}
                </div>
              </div>
            )}
            {currentMessages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                onAvatarClick={(name) => {
                  const agent = AGENTS_DB.find((a) => a.name === name);
                  if (agent) setProfileDrawerAgent(agent.id);
                }}
              />
            ))}
          </div>

          <div className="chat-input">
            <div className="chat-input-box">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="输入消息或任务指令..."
                value={inputText}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
              />
              <button className="chat-send" onClick={handleSend} disabled={!inputText.trim()}>
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatPage;
