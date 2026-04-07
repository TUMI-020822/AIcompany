import { io, Socket } from 'socket.io-client';
import type { Company, AgentConfig } from '../types';

// ====== REST API Wrapper ======
const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Companies
export function getCompanies() {
  return request<Company[]>('/companies');
}

export function createCompany(data: { name: string; industry: string; desc: string }) {
  return request<Company>('/companies', { method: 'POST', body: JSON.stringify(data) });
}

export function deleteCompany(id: string) {
  return request<void>(`/companies/${id}`, { method: 'DELETE' });
}

export function getCompany(id: string) {
  return request<Company>(`/companies/${id}`);
}

// Catalog
export function getCatalog() {
  return request<{ agents: unknown[]; providers: unknown[]; skills: unknown[]; mcpServers: unknown[] }>('/catalog');
}

// Agent management
export function hireAgent(companyId: string, agentId: string) {
  return request<Company>(`/companies/${companyId}/hire`, { method: 'POST', body: JSON.stringify({ agentId }) });
}

export function fireAgent(companyId: string, agentId: string) {
  return request<Company>(`/companies/${companyId}/fire`, { method: 'POST', body: JSON.stringify({ agentId }) });
}

export function updateAgentConfig(companyId: string, agentId: string, config: Partial<AgentConfig>) {
  return request<Company>(`/companies/${companyId}/agents/${agentId}/config`, { method: 'PUT', body: JSON.stringify(config) });
}

// Conversations & Messages
export function getConversations(companyId: string) {
  return request<unknown[]>(`/companies/${companyId}/conversations`);
}

export function getMessages(companyId: string, conversationId: string) {
  return request<unknown[]>(`/companies/${companyId}/conversations/${conversationId}/messages`);
}

export function sendMessage(companyId: string, conversationId: string, text: string) {
  return request<unknown>(`/companies/${companyId}/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// Tasks
export function getTasks(companyId: string) {
  return request<unknown[]>(`/companies/${companyId}/tasks`);
}

export function createTask(companyId: string, data: { name: string; desc: string }) {
  return request<unknown>(`/companies/${companyId}/tasks`, { method: 'POST', body: JSON.stringify(data) });
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
