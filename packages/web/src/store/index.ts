import { create } from 'zustand';
import type { Company, Message, Task, Conversation } from '../types';

export type PageId = 'chat' | 'hire' | 'contacts' | 'work' | 'output';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface AppState {
  // Companies
  companies: Company[];
  setCompanies: (companies: Company[]) => void;
  addCompany: (company: Company) => void;
  removeCompany: (id: string) => void;
  updateCompany: (company: Company) => void;

  // Current company
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;

  // Navigation
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;

  // Chat
  currentChat: string | null;
  setCurrentChat: (chatId: string | null) => void;
  messages: Record<string, Message[]>;
  setMessages: (key: string, msgs: Message[]) => void;
  addMessage: (key: string, msg: Message) => void;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;

  // Conversations
  conversations: Conversation[];
  setConversations: (convos: Conversation[]) => void;

  // UI state
  hireDeptFilter: string;
  setHireDeptFilter: (dept: string) => void;
  expandedDepts: Record<string, boolean>;
  toggleDeptExpand: (dept: string) => void;
  expandedOutputs: Record<string, boolean>;
  toggleOutputExpand: (id: string) => void;

  // Modals
  configModalAgent: string | null;
  setConfigModalAgent: (agentId: string | null) => void;
  profileDrawerAgent: string | null;
  setProfileDrawerAgent: (agentId: string | null) => void;

  // Toast
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error') => void;
  removeToast: (id: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Companies
  companies: JSON.parse(localStorage.getItem('ai_companies') || '[]'),
  setCompanies: (companies) => {
    localStorage.setItem('ai_companies', JSON.stringify(companies));
    set({ companies });
  },
  addCompany: (company) => {
    const companies = [...get().companies, company];
    localStorage.setItem('ai_companies', JSON.stringify(companies));
    set({ companies });
  },
  removeCompany: (id) => {
    const companies = get().companies.filter(c => c.id !== id);
    localStorage.setItem('ai_companies', JSON.stringify(companies));
    set({ companies });
  },
  updateCompany: (company) => {
    const companies = get().companies.map(c => c.id === company.id ? company : c);
    localStorage.setItem('ai_companies', JSON.stringify(companies));
    set({ companies, currentCompany: company });
  },

  // Current company
  currentCompany: null,
  setCurrentCompany: (company) => set({ currentCompany: company }),

  // Navigation
  currentPage: 'chat',
  setCurrentPage: (page) => set({ currentPage: page }),

  // Chat
  currentChat: null,
  setCurrentChat: (chatId) => set({ currentChat: chatId }),
  messages: {},
  setMessages: (key, msgs) => set((state) => ({ messages: { ...state.messages, [key]: msgs } })),
  addMessage: (key, msg) => set((state) => {
    const existing = state.messages[key] || [];
    return { messages: { ...state.messages, [key]: [...existing, msg] } };
  }),

  // Tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),

  // Conversations
  conversations: [],
  setConversations: (conversations) => set({ conversations }),

  // UI state
  hireDeptFilter: '全部',
  setHireDeptFilter: (dept) => set({ hireDeptFilter: dept }),
  expandedDepts: {},
  toggleDeptExpand: (dept) => set((state) => ({
    expandedDepts: { ...state.expandedDepts, [dept]: !(state.expandedDepts[dept] ?? true) }
  })),
  expandedOutputs: {},
  toggleOutputExpand: (id) => set((state) => ({
    expandedOutputs: { ...state.expandedOutputs, [id]: !(state.expandedOutputs[id] ?? true) }
  })),

  // Modals
  configModalAgent: null,
  setConfigModalAgent: (agentId) => set({ configModalAgent: agentId }),
  profileDrawerAgent: null,
  setProfileDrawerAgent: (agentId) => set({ profileDrawerAgent: agentId }),

  // Toast
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = 'toast_' + Date.now();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 3000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));
