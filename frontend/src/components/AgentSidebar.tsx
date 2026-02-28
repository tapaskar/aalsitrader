import { Agent, PaperTrade } from '../types';
import { Activity, Moon, Beaker, Crown, GraduationCap, Cpu, Shield, Globe, BookOpen } from 'lucide-react';

interface AgentSidebarProps {
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
  paperTrades?: PaperTrade[];
  paperMode?: { mode: 'paper' | 'live'; enabled: boolean };
}

// Paper trading stats for Sigma display
interface SigmaPaperStats {
  trades: number;
  winRate: number;
  pnl: number;
}

// Agent persona configurations
const AGENT_PERSONAS: Record<string, { icon: React.ReactNode; emoji: string; animation: string; bgPattern: string }> = {
  sigma: {
    icon: <Crown className="w-6 h-6" />,
    emoji: '👑',
    animation: 'animate-float',
    bgPattern: 'bg-gradient-to-br from-emerald-500/30 to-emerald-700/20',
  },
  alpha: {
    icon: <GraduationCap className="w-6 h-6" />,
    emoji: '🎓',
    animation: 'animate-think',
    bgPattern: 'bg-gradient-to-br from-red-500/30 to-red-700/20',
  },
  beta: {
    icon: <Cpu className="w-6 h-6" />,
    emoji: '💻',
    animation: 'animate-pulse-fast',
    bgPattern: 'bg-gradient-to-br from-cyan-500/30 to-cyan-700/20',
  },
  gamma: {
    icon: <Shield className="w-6 h-6" />,
    emoji: '🛡️',
    animation: 'animate-shield',
    bgPattern: 'bg-gradient-to-br from-purple-500/30 to-purple-700/20',
  },
  theta: {
    icon: <Globe className="w-6 h-6" />,
    emoji: '🌍',
    animation: 'animate-spin-slow',
    bgPattern: 'bg-gradient-to-br from-orange-500/30 to-orange-700/20',
  },
  delta: {
    icon: <BookOpen className="w-6 h-6" />,
    emoji: '📚',
    animation: 'animate-bounce-subtle',
    bgPattern: 'bg-gradient-to-br from-blue-500/30 to-blue-700/20',
  },
};

// Agent Avatar Component with persona styling
function AgentAvatar({ agentId, color, isActive }: { agentId: string; color: string; isActive: boolean }) {
  const persona = AGENT_PERSONAS[agentId] || AGENT_PERSONAS.alpha;

  return (
    <div
      className={`relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${
        isActive ? persona.animation : 'opacity-60'
      } ${persona.bgPattern}`}
      style={{
        boxShadow: isActive ? `0 0 20px ${color}40, inset 0 0 15px ${color}20` : 'none',
        border: `2px solid ${isActive ? color : '#3d3d4d'}`,
      }}
    >
      {/* Inner glow effect */}
      {isActive && (
        <div
          className="absolute inset-0 animate-pulse opacity-30"
          style={{ background: `radial-gradient(circle, ${color}60 0%, transparent 70%)` }}
        />
      )}

      {/* Icon */}
      <div style={{ color }} className="relative z-10">
        {persona.icon}
      </div>

      {/* Status ring */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ border: `2px solid ${color}` }}
        />
      )}
    </div>
  );
}

export function AgentSidebar({ agents, onSelectAgent, paperTrades = [], paperMode }: AgentSidebarProps) {
  // Sort: Sigma (Prime/orchestrator) always at top, then active, then sleeping
  const activeAgents = agents.filter((a) => a.status === 'active');
  const sleepingAgents = agents.filter((a) => a.status === 'sleeping');
  const orchestrator = agents.find((a) => a.id === 'sigma');
  const otherActive = activeAgents.filter((a) => a.id !== 'sigma');
  const otherSleeping = sleepingAgents.filter((a) => a.id !== 'sigma');

  const orderedAgents = [
    ...(orchestrator ? [orchestrator] : []),
    ...otherActive,
    ...otherSleeping,
  ];

  // Calculate Sigma paper trading stats
  const sigmaPaperStats: SigmaPaperStats = paperTrades.length > 0
    ? {
        trades: paperTrades.length,
        winRate: Math.round(
          (paperTrades.filter(t => t.status === 'closed' && (t.netPnL || 0) > 0).length / 
           Math.max(1, paperTrades.filter(t => t.status === 'closed').length)) * 100
        ),
        pnl: paperTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0),
      }
    : { trades: 0, winRate: 0, pnl: 0 };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 md:p-6 h-full flex flex-col overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 shrink-0">
        Squad Agents
      </h3>

      <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
        {orderedAgents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 ${
              agent.status === 'active'
                ? 'bg-card-hover hover:scale-[1.02]'
                : 'bg-card-hover/50 border-border/70 opacity-70 hover:opacity-90'
            } ${agent.id === 'sigma' ? 'ring-2 ring-sigma/50' : ''}`}
            style={{
              borderColor: agent.status === 'active' ? agent.color : undefined,
              backgroundColor: agent.id === 'sigma' ? `${agent.color}15` : undefined,
            }}
          >
            <div className="flex items-center gap-3">
              {/* Avatar with Persona */}
              <AgentAvatar
                agentId={agent.id}
                color={agent.color}
                isActive={agent.status === 'active'}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{agent.name}</span>
                  {agent.id === 'sigma' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-sigma/20 text-sigma rounded">
                      ORCH
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400 block truncate">
                  {agent.role}
                </span>
              </div>

              {/* Status */}
              <div className="flex flex-col items-end gap-1">
                {agent.status === 'active' ? (
                  <>
                    <div 
                      className="w-2.5 h-2.5 rounded-full animate-pulse"
                      style={{ backgroundColor: agent.color }}
                    />
                    <Activity className="w-3 h-3 text-gray-500" />
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-gray-500" />
                    <span className="text-[10px] text-gray-500">{agent.nextWake}</span>
                  </>
                )}
              </div>
            </div>

            {/* Current Task */}
            {agent.status === 'active' && agent.currentTask && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: agent.color }} />
                  {agent.currentTask}
                </p>
              </div>
            )}

            {/* Sigma Paper Trading Status */}
            {agent.id === 'sigma' && paperMode?.enabled && sigmaPaperStats.trades > 0 && (
              <div className="mt-3 pt-3 border-t border-sigma/20">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Beaker className="w-3 h-3 text-sigma" />
                  <span className="text-[10px] font-medium text-sigma uppercase tracking-wider">
                    AI Trader {paperMode.mode === 'live' ? '➜ Live' : 'Testing'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400">
                    {sigmaPaperStats.trades} trades
                  </span>
                  <span className="text-gray-400">
                    {sigmaPaperStats.winRate}% WR
                  </span>
                  <span className={`${sigmaPaperStats.pnl >= 0 ? 'text-active' : 'text-danger'}`}>
                    {sigmaPaperStats.pnl >= 0 ? '+' : ''}₹{Math.abs(sigmaPaperStats.pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            )}

            {/* Sigma Paper Mode Indicator when active but no trades yet */}
            {agent.id === 'sigma' && paperMode?.enabled && sigmaPaperStats.trades === 0 && (
              <div className="mt-3 pt-3 border-t border-sigma/20">
                <div className="flex items-center gap-1.5">
                  <Beaker className="w-3 h-3 text-sigma/70" />
                  <span className="text-[10px] text-gray-500">
                    Paper Mode Active · Waiting for signals...
                  </span>
                </div>
              </div>
            )}

            {/* Sleeping indicator */}
            {agent.status === 'sleeping' && agent.id !== 'sigma' && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-xs text-gray-500 italic">
                  Waiting for next activation...
                </p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border text-xs text-gray-500 space-y-1 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-active" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sleeping" />
          <span>Sleeping</span>
        </div>
      </div>
    </div>
  );
}
