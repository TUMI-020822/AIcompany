import { create } from 'zustand';
import type { Company, Message, Task, Conversation } from '../types';
import * as api from '../services/api';

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
  loadCompanies: () => Promise<void>;

  // Current company
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  enterCompany: (id: string) => Promise<Company | null>;

  // Navigation
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;

  // Chat
  currentChat: string | null;
  setCurrentChat: (chatId: string | null) => void;
  messages: Record<string, Message[]>;
  setMessages: (key: string, msgs: Message[]) => void;
  addMessage: (key: string, msg: Message) => void;
  updateLastMessage: (key: string, text: string) => void;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;

  // Conversations
  conversations: Conversation[];
  setConversations: (convos: Conversation[]) => void;

  // Catalog (agents from server)
  catalogAgents: any[];
  setCatalogAgents: (agents: any[]) => void;
  loadCatalog: (companyId?: string) => Promise<void>;

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
  companies: [],
  setCompanies: (companies) => set({ companies }),
  addCompany: (company) => set((s) => ({ companies: [...s.companies, company] })),
  removeCompany: (id) => {
    api.deleteCompany(id).catch((err) => console.error('Failed to delete company:', err));
    set((s) => ({ companies: s.companies.filter((c) => c.id !== id) }));
  },
  updateCompany: (company) => {
    set((s) => ({
      companies: s.companies.map((c) => (c.id === company.id ? company : c)),
      currentCompany: s.currentCompany?.id === company.id ? company : s.currentCompany,
    }));
  },
  loadCompanies: async () => {
    try {
      const rows = await api.getCompanies();
      const companies: Company[] = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        industry: r.industry || '',
        desc: r.description || '',
        created: new Date(r.createdAt).getTime(),
        employees: [],
        tasks: [],
        employeeConfigs: {},
      }));
      set({ companies });
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  },

  // Current company
  currentCompany: null,
  setCurrentCompany: (company) => set({ currentCompany: company }),
  enterCompany: async (id: string) => {
    try {
      // Load company details
      const companyData = await api.getCompany(id);
      // Load hired agents
      const hiredAgents = await api.getHiredAgents(id);

      const employees = hiredAgents.map((e: any) => e.agentId);
      const employeeConfigs: Record<string, any> = {};
      hiredAgents.forEach((e: any) => {
        employeeConfigs[e.agentId] = {
          provider: (e.config as any)?.provider || 'deepseek',
          model: (e.config as any)?.model || 'deepseek-chat',
          apiKey: (e.config as any)?.apiKey || '',
          baseUrl: (e.config as any)?.baseUrl || '',
          temperature: (e.config as any)?.temperature ?? 0.7,
          maxTokens: (e.config as any)?.maxTokens || 4096,
          systemPrompt: (e.config as any)?.systemPrompt || '',
          skills: (e.config as any)?.skills || [],
          mcpServers: (e.config as any)?.mcpServers || [],
          autoagent: (e.config as any)?.autoagent || { enabled: false, programMd: '', benchTasks: '', score: 0, iterations: 0, bestScore: 0, log: [] },
        };
      });

      const company: Company = {
        id: companyData.id,
        name: companyData.name,
        industry: companyData.industry || '',
        desc: companyData.description || '',
        created: new Date(companyData.createdAt).getTime(),
        employees,
        tasks: [],
        employeeConfigs,
      };

      set({ currentCompany: company });
      // Also update in list
      get().updateCompany(company);
      return company;
    } catch (err) {
      console.error('Failed to enter company:', err);
      return null;
    }
  },

  // Navigation
  currentPage: 'chat',
  setCurrentPage: (page) => set({ currentPage: page }),

  // Chat
  currentChat: null,
  setCurrentChat: (chatId) => set({ currentChat: chatId }),
  messages: {},
  setMessages: (key, msgs) => set((state) => ({ messages: { ...state.messages, [key]: msgs } })),
  addMessage: (key, msg) =>
    set((state) => {
      const existing = state.messages[key] || [];
      return { messages: { ...state.messages, [key]: [...existing, msg] } };
    }),
  updateLastMessage: (key, text) =>
    set((state) => {
      const msgs = state.messages[key] || [];
      if (msgs.length === 0) return state;
      const updated = [...msgs];
      updated[updated.length - 1] = { ...updated[updated.length - 1], text };
      return { messages: { ...state.messages, [key]: updated } };
    }),

  // Tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),

  // Conversations
  conversations: [],
  setConversations: (conversations) => set({ conversations }),

  // Catalog
  catalogAgents: [],
  setCatalogAgents: (agents) => set({ catalogAgents: agents }),
  loadCatalog: async (companyId?: string) => {
    try {
      const agents = await api.getCatalog(companyId);
      set({ catalogAgents: agents });
    } catch (err) {
      console.error('Failed to load catalog:', err);
    }
  },

  // UI state
  hireDeptFilter: '\u5168\u90E8',
  setHireDeptFilter: (dept) => set({ hireDeptFilter: dept }),
  expandedDepts: {},
  toggleDeptExpand: (dept) =>
    set((state) => ({
      expandedDepts: { ...state.expandedDepts, [dept]: !(state.expandedDepts[dept] ?? true) },
    })),
  expandedOutputs: {},
  toggleOutputExpand: (id) =>
    set((state) => ({
      expandedOutputs: { ...state.expandedOutputs, [id]: !(state.expandedOutputs[id] ?? true) },
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
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
