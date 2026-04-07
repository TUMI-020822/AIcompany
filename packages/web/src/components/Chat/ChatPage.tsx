import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store';
import { DEPT_COLORS } from '../../types';
import type { Agent, Conversation, Message } from '../../types';
import { SearchIcon, SendIcon, HireIcon, SettingsIcon } from '../shared/Icons';
import MessageBubble from './MessageBubble';
import * as api from '../../services/api';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '\u521A\u521A';
  if (diff < 3600000) return Math.floor(diff / 60000) + '\u5206\u949F\u524D';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '\u5C0F\u65F6\u524D';
  return Math.floor(diff / 86400000) + '\u5929\u524D';
}

const ChatPage: React.FC = () => {
  const currentCompany = useStore((s) => s.currentCompany);
  const catalogAgents = useStore((s) => s.catalogAgents);
  const currentChat = useStore((s) => s.currentChat);
  const setCurrentChat = useStore((s) => s.setCurrentChat);
  const messages = useStore((s) => s.messages);
  const addMessage = useStore((s) => s.addMessage);
  const updateLastMessage = useStore((s) => s.updateLastMessage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const setProfileDrawerAgent = useStore((s) => s.setProfileDrawerAgent);
  const addToast = useStore((s) => s.addToast);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationMapRef = useRef<Record<string, string>>({});
  const socketRef = useRef<ReturnType<typeof api.getSocket> | null>(null);

  const company = currentCompany;

  // Build agent lookup from catalog (safe even when company is null)
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

  const employees = company ? (company.employees || [])
    .map((eid) => agentMap[eid])
    .filter(Boolean) as Agent[] : [];

  // Build chat list from hired agents
  const chats: Conversation[] = [];
  if (employees.length > 0) {
    employees.forEach((agent) => {
      chats.push({
        id: 'agent_' + agent.id,
        name: agent.name,
        type: 'agent',
        agent,
        preview: agent.desc.slice(0, 20) + '...',
        time: Date.now() - 120000,
        color: DEPT_COLORS[agent.dept] || '#3370ff',
      });
    });
  }

  const activeChat = currentChat || (chats.length > 0 ? chats[0].id : null);
  const chatKey = company ? company.id + '_' + activeChat : '';
  const currentMessages = messages[chatKey] || [];
  const activeChatData = chats.find((c) => c.id === activeChat);

  useEffect(() => {
    if (!company || !currentChat && chats.length > 0) {
      setCurrentChat(chats[0].id);
    }
  }, [currentChat, chats.length, setCurrentChat, company]);

  useEffect(() => {
    if (!company) return;
    let socket: any;
    try {
      socket = api.getSocket();
      socketRef.current = socket;
    } catch (err) {
      console.warn('[ChatPage] Failed to init socket:', err);
      return;
    }

    socket.on('message_token', (data: { conversationId: string; token: string }) => {
      setStreamingText((prev) => prev + data.token);
    });

    socket.on('message_complete', (data: { conversationId: string; userMessage: any; assistantMessage: any }) => {
      const entries = Object.entries(conversationMapRef.current);
      let matchedKey = '';
      for (const [key, cid] of entries) {
        if (cid === data.conversationId) {
          matchedKey = key;
          break;
        }
      }
      if (matchedKey) {
        const agentId = data.assistantMessage.agentId;
        const agent = agentMap[agentId];
        const store = useStore.getState();
        const msgs = store.messages[matchedKey] || [];
        const filtered = msgs.filter((m) => !m.typing);
        filtered.push({
          self: false,
          sender: agent?.name || 'AI',
          text: data.assistantMessage.content,
          color: agent ? DEPT_COLORS[agent.dept] : '#3370ff',
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        });
        store.setMessages(matchedKey, filtered);
      }
      setSending(false);
      setStreamingText('');
    });

    socket.on('agent_typing', (data: { conversationId: string; typing: boolean }) => {
    });

    socket.on('error', (data: { message: string }) => {
      setSending(false);
      setStreamingText('');
      addToast(data.message || '发送失败', 'error');
    });

    return () => {
      socket.off('message_token');
      socket.off('message_complete');
      socket.off('agent_typing');
      socket.off('error');
    };
  }, [company]);

  useEffect(() => {
    if (!company || !streamingText || !sending) return;
    const store = useStore.getState();
    const msgs = store.messages[chatKey] || [];
    const last = msgs[msgs.length - 1];
    if (last && last.typing) {
      store.updateLastMessage(chatKey, streamingText);
    }
  }, [streamingText, chatKey, sending, company]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [currentMessages.length, streamingText]);

  // Early return AFTER all hooks
  if (!company) return null;

  const ensureConversation = async (chatId: string): Promise<string | null> => {
    // Check if we already have a conversation ID for this chat
    const existing = conversationMapRef.current[company.id + '_' + chatId];
    if (existing) return existing;

    // Create a new conversation via API
    const agentId = chatId.replace('agent_', '');
    const agent = agentMap[agentId];
    try {
      const conv = await api.createConversation(company.id, {
        type: 'agent',
        targetId: agentId,
        name: agent?.name || agentId,
      });
      conversationMapRef.current[company.id + '_' + chatId] = conv.id;
      // Join the socket room
      socketRef.current?.emit('join_conversation', conv.id);
      return conv.id;
    } catch (err) {
      console.error('Failed to create conversation:', err);
      addToast('\u521B\u5EFA\u5BF9\u8BDD\u5931\u8D25', 'error');
      return null;
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !activeChat || sending) return;

    // Add user message immediately
    addMessage(chatKey, {
      self: true,
      text,
      sender: '\u6211',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    });
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);
    setStreamingText('');

    // Ensure we have a conversation
    const conversationId = await ensureConversation(activeChat);
    if (!conversationId) {
      setSending(false);
      return;
    }

    // Add typing placeholder
    const agentId = activeChat.replace('agent_', '');
    const agent = agentMap[agentId] || null;
    addMessage(chatKey, {
      self: false,
      sender: agent?.name || 'AI',
      text: '',
      color: agent ? DEPT_COLORS[agent.dept] : '#3370ff',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      typing: true,
    });

    // Send via socket
    socketRef.current?.emit('send_message', {
      conversationId,
      content: text,
      senderId: 'user',
    });
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
              {sending && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>正在输入...</span>}
            </div>
          </div>

          <div className="chat-messages" ref={messagesRef}>
            {currentMessages.length === 0 && (
              <div className="msg msg-system">
                <div className="msg-bubble">
                  与 {activeChatData?.name || 'AI'} 开始对话
                </div>
              </div>
            )}
            {currentMessages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                onAvatarClick={(name) => {
                  const agent = employees.find((a) => a.name === name);
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
                placeholder="输入消息..."
                value={inputText}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                disabled={sending}
              />
              <button className="chat-send" onClick={handleSend} disabled={!inputText.trim() || sending}>
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
