import { io, Socket } from 'socket.io-client';

// ====== REST API Wrapper ======
const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Companies ──────────────────────────────────────────────────────────────
export function getCompanies() {
  return request<any[]>('/companies');
}

export function createCompany(data: { name: string; industry: string; description: string }) {
  return request<any>('/companies', { method: 'POST', body: JSON.stringify(data) });
}

export function deleteCompany(id: string) {
  return request<void>(`/companies/${id}`, { method: 'DELETE' });
}

export function getCompany(id: string) {
  return request<any>(`/companies/${id}`);
}

// ── Agent Catalog ──────────────────────────────────────────────────────────
export function getCatalog(companyId?: string) {
  const qs = companyId ? `?companyId=${companyId}` : '';
  return request<any[]>(`/agents/catalog${qs}`);
}

// ── Agent Management ───────────────────────────────────────────────────────
export function getHiredAgents(companyId: string) {
  return request<any[]>(`/agents/companies/${companyId}/agents`);
}

export function hireAgent(companyId: string, agentId: string, config?: Record<string, unknown>) {
  return request<any>(`/agents/companies/${companyId}/hire`, {
    method: 'POST',
    body: JSON.stringify({ agentId, config }),
  });
}

export function fireAgent(companyId: string, agentId: string) {
  return request<any>(`/agents/companies/${companyId}/agents/${agentId}`, { method: 'DELETE' });
}

export function updateAgentConfig(companyId: string, agentId: string, config: Record<string, unknown>) {
  return request<any>(`/agents/companies/${companyId}/agents/${agentId}/config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// ── Conversations & Messages ───────────────────────────────────────────────
export function getConversations(companyId: string) {
  return request<any[]>(`/chat/companies/${companyId}/conversations`);
}

export function createConversation(companyId: string, data: { type: string; targetId: string; name: string }) {
  return request<any>(`/chat/companies/${companyId}/conversations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getMessages(conversationId: string, limit = 50, offset = 0) {
  return request<{ messages: any[]; total: number }>(`/chat/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`);
}

// ── Tasks ──────────────────────────────────────────────────────────────────
export function getTasks(companyId: string) {
  return request<any[]>(`/tasks/companies/${companyId}/tasks`);
}

export function createTask(companyId: string, data: { name: string; description: string }) {
  return request<any>(`/tasks/companies/${companyId}/tasks`, { method: 'POST', body: JSON.stringify(data) });
}

// ====== Socket.IO Singleton ======
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
