import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent, Activity, CommMessage, Trade, SquadStats, FilterType, PaperTrade, PaperPortfolio, PaperMetrics, EquityPoint, PaperModeStat, SigmaApprovalItem } from '../types';

interface DashboardState {
  // Agents
  agents: Agent[];
  selectedAgent: Agent | null;
  setSelectedAgent: (agent: Agent | null) => void;
  updateAgentStatus: (agentId: string, status: Agent['status'], currentTask?: string) => void;
  
  // Activities
  activities: Activity[];
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp'> & { id?: string; timestamp?: Date | number }) => void;
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
  filteredActivities: () => Activity[];
  
  // Communications
  comms: CommMessage[];
  addComm: (comm: Omit<CommMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: Date | number }) => void;
  
  // Trades
  trades: Trade[];
  addTrade: (trade: Omit<Trade, 'id' | 'entryTime'> & { entryTime?: Date }) => void;
  updateTrade: (tradeId: string, updates: Partial<Trade>) => void;
  
  // Stats
  stats: SquadStats;
  updateStats: () => void;
  
  // UI
  soundEnabled: boolean;
  toggleSound: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  
  // WebSocket
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;

  // Paper Trading
  paperMode: PaperModeStat;
  paperPortfolio: PaperPortfolio | null;
  paperTrades: PaperTrade[];
  paperMetrics: PaperMetrics | null;
  equityCurve: EquityPoint[];
  pendingApprovals: SigmaApprovalItem[];
  paperTradeCount: number; // For badges
  
  setPaperMode: (mode: PaperModeStat) => void;
  setPaperPortfolio: (portfolio: PaperPortfolio) => void;
  addPaperTrade: (trade: PaperTrade) => void;
  setPaperTrades: (trades: PaperTrade[]) => void;
  updatePaperTrade: (tradeId: string, updates: Partial<PaperTrade>) => void;
  closePaperTrade: (trade: PaperTrade) => void;
  setPaperMetrics: (metrics: PaperMetrics) => void;
  setEquityCurve: (curve: EquityPoint[]) => void;
  setPendingApprovals: (approvals: SigmaApprovalItem[]) => void;
  addPendingApproval: (approval: SigmaApprovalItem) => void;
}

const initialAgents: Agent[] = [
  {
    id: 'alpha',
    name: 'Professor',
    greek: 'α',
    role: 'Research Agent',
    color: '#ff6b6b',
    status: 'active',
    currentTask: 'Scanning News',
    lastActivity: new Date(),
    stats: { tasksCompleted: 142, alertsSent: 23, accuracy: 87 },
  },
  {
    id: 'beta',
    name: 'Techno-Kid',
    greek: 'β',
    role: 'Technical Analyst',
    color: '#4ecdc4',
    status: 'active',
    currentTask: 'Analyzing Levels',
    lastActivity: new Date(),
    stats: { tasksCompleted: 98, alertsSent: 15, accuracy: 91 },
  },
  {
    id: 'gamma',
    name: 'Risko-Frisco',
    greek: 'γ',
    role: 'Risk Manager',
    color: '#a855f7',
    status: 'active',
    currentTask: 'Monitoring Risk',
    lastActivity: new Date(),
    stats: { tasksCompleted: 203, alertsSent: 8, accuracy: 95 },
  },
  {
    id: 'sigma',
    name: 'Prime',
    greek: 'Σ',
    role: 'Trade Hunter / Orchestrator',
    color: '#10b981',
    status: 'active',
    currentTask: 'Orchestrating Squad',
    lastActivity: new Date(),
    stats: { tasksCompleted: 67, alertsSent: 31, accuracy: 78 },
  },
  {
    id: 'theta',
    name: 'Macro',
    greek: 'θ',
    role: 'Macro Watcher',
    color: '#f97316',
    status: 'sleeping',
    nextWake: '9:30 AM',
    lastActivity: new Date(Date.now() - 1800000),
    stats: { tasksCompleted: 112, alertsSent: 12, accuracy: 84 },
  },
  {
    id: 'delta',
    name: 'Booky',
    greek: 'δ',
    role: 'Trade Journal',
    color: '#3b82f6',
    status: 'sleeping',
    nextWake: '4:00 PM',
    lastActivity: new Date(Date.now() - 3600000),
    stats: { tasksCompleted: 45, alertsSent: 0, accuracy: 100 },
  },
];

const initialStats: SquadStats = {
  totalTrades: 0,
  winRate: 0,
  totalPnl: 0,
  avgRMultiple: 0,
  bestTrade: null,
  worstTrade: null,
  activeAgents: 4,
  sleepingAgents: 2,
};

const initialPaperMode: PaperModeStat = {
  mode: 'paper',
  enabled: true,
  requireSigmaApproval: true,
  autoTradingEnabled: false,
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      // Initial state
      agents: initialAgents,
      selectedAgent: null,
      activities: [],
      filter: 'all',
      comms: [],
      trades: [],
      stats: initialStats,
      soundEnabled: true,
      darkMode: true,
      wsConnected: false,
      // Paper Trading
      paperMode: initialPaperMode,
      paperPortfolio: null,
      paperTrades: [],
      paperMetrics: null,
      equityCurve: [],
      pendingApprovals: [],
      paperTradeCount: 0,

      // Actions
      setSelectedAgent: (agent) => set({ selectedAgent: agent }),
      
      updateAgentStatus: (agentId, status, currentTask) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId
              ? { ...a, status, currentTask, lastActivity: new Date() }
              : a
          ),
        }));
        get().updateStats();
      },

      addActivity: (activity) => {
        const ts = activity.timestamp;
        const newActivity: Activity = {
          ...activity,
          id: activity.id || crypto.randomUUID(),
          timestamp: typeof ts === 'number' ? new Date(ts) : ts || new Date(),
        };
        set((state) => {
          // Deduplicate: skip if same id or same agent+content within 60s
          const isDupe = state.activities.some((a) => {
            if (a.id === newActivity.id) return true;
            if (a.agentId === newActivity.agentId && a.content === newActivity.content) {
              const t1 = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
              const t2 = typeof newActivity.timestamp === 'number' ? newActivity.timestamp : new Date(newActivity.timestamp).getTime();
              return Math.abs(t1 - t2) < 60000;
            }
            return false;
          });
          if (isDupe) return state;
          return {
            activities: [newActivity, ...state.activities].slice(0, 100),
          };
        });
      },

      setFilter: (filter) => set({ filter }),
      
      filteredActivities: () => {
        const { activities, filter } = get();
        if (filter === 'all') return activities;
        if (filter === 'alerts') return activities.filter((a) => a.type === 'alert' || a.type === 'warning');
        if (filter === 'trades') return activities.filter((a) => a.tags.includes('Trade'));
        return activities.filter((a) => a.agentId === filter);
      },

      addComm: (comm) => {
        const newComm: CommMessage = {
          ...comm,
          id: comm.id || crypto.randomUUID(),
          timestamp: typeof comm.timestamp === 'number' ? new Date(comm.timestamp) : comm.timestamp || new Date(),
        };
        set((state) => {
          const isDupe = state.comms.some((c) => c.id === newComm.id);
          if (isDupe) return state;
          return {
            comms: [newComm, ...state.comms].slice(0, 50),
          };
        });
      },

      addTrade: (trade) => {
        const newTrade: Trade = {
          ...trade,
          id: crypto.randomUUID(),
          entryTime: trade.entryTime || new Date(),
        };
        set((state) => ({
          trades: [...state.trades, newTrade],
        }));
        get().updateStats();
      },

      updateTrade: (tradeId, updates) => {
        set((state) => ({
          trades: state.trades.map((t) =>
            t.id === tradeId ? { ...t, ...updates } : t
          ),
        }));
        get().updateStats();
      },

      updateStats: () => {
        const { trades, agents } = get();
        const closedTrades = trades.filter((t) => t.status === 'closed' && t.pnl !== undefined);
        
        if (closedTrades.length === 0) {
          set({
            stats: {
              ...initialStats,
              activeAgents: agents.filter((a) => a.status === 'active').length,
              sleepingAgents: agents.filter((a) => a.status === 'sleeping').length,
            },
          });
          return;
        }

        const wins = closedTrades.filter((t) => (t.pnl || 0) > 0);
        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        
        set({
          stats: {
            totalTrades: trades.length,
            winRate: Math.round((wins.length / closedTrades.length) * 100),
            totalPnl,
            avgRMultiple: closedTrades.reduce((sum, t) => sum + (t.grade === 'A' ? 2 : t.grade === 'B' ? 1.5 : 1), 0) / closedTrades.length,
            bestTrade: closedTrades.reduce((best, t) => ((t.pnl || 0) > (best?.pnl || 0) ? t : best), null as Trade | null),
            worstTrade: closedTrades.reduce((worst, t) => ((t.pnl || 0) < (worst?.pnl || 0) ? t : worst), null as Trade | null),
            activeAgents: agents.filter((a) => a.status === 'active').length,
            sleepingAgents: agents.filter((a) => a.status === 'sleeping').length,
          },
        });
      },

      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setWsConnected: (connected) => set({ wsConnected: connected }),

      // Paper Trading Actions
      setPaperMode: (mode) => set({ paperMode: mode }),
      
      setPaperPortfolio: (portfolio) => set({ paperPortfolio: portfolio }),
      
      addPaperTrade: (trade) => {
        set((state) => ({
          paperTrades: [trade, ...state.paperTrades],
          paperTradeCount: state.paperTradeCount + 1,
        }));
      },
      
      setPaperTrades: (trades) => {
        set({ paperTrades: trades });
      },
      
      updatePaperTrade: (tradeId, updates) => {
        set((state) => ({
          paperTrades: state.paperTrades.map((t) =>
            t.id === tradeId ? { ...t, ...updates } : t
          ),
        }));
      },
      
      closePaperTrade: (trade) => {
        set((state) => ({
          paperTrades: state.paperTrades.map((t) =>
            t.id === trade.id ? trade : t
          ),
        }));
      },
      
      setPaperMetrics: (metrics) => set({ paperMetrics: metrics }),
      
      setEquityCurve: (curve) => set({ equityCurve: curve }),
      
      setPendingApprovals: (approvals) => set({ pendingApprovals: approvals }),
      
      addPendingApproval: (approval) => {
        set((state) => ({
          pendingApprovals: [...state.pendingApprovals, approval],
        }));
      },
    }),
    {
      name: 'trading-squad-storage',
      partialize: (state) => ({ 
        soundEnabled: state.soundEnabled, 
        darkMode: state.darkMode,
        trades: state.trades,
      }),
    }
  )
);
