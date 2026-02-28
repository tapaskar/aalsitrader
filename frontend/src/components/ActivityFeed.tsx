import { useState, useEffect, useRef } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { Activity, PaperTrade, BetaTechMetadata } from '../types';
import { BetaActivityDetail } from './BetaActivityDetail';
import { getAuthHeaders } from '../store/authStore';
import { AlertTriangle, CheckCircle, Info, AlertCircle, TrendingUp, TrendingDown, Clock, X, Wallet, ArrowUpCircle, ArrowDownCircle, BarChart3, GraduationCap, Cpu, Shield, Globe, BookOpen, MessageCircle, AtSign, Radio, Briefcase, Target } from 'lucide-react';

const typeIcons = {
  info: <Info className="w-3 h-3 text-accent" />,
  alert: <AlertTriangle className="w-3 h-3 text-danger" />,
  success: <CheckCircle className="w-3 h-3 text-active" />,
  warning: <AlertCircle className="w-3 h-3 text-warning" />,
  error: <AlertTriangle className="w-3 h-3 text-danger" />,
};

// Squad agents (excluding Prime who uses the chat panel)
const SQUAD_AGENTS = [
  { id: 'alpha', name: 'Professor', icon: GraduationCap, role: 'Research', color: '#ff6b6b', animation: 'animate-think' },
  { id: 'beta', name: 'Techno-Kid', icon: Cpu, role: 'Technical', color: '#4ecdc4', animation: 'animate-pulse-fast' },
  { id: 'gamma', name: 'Risko', icon: Shield, role: 'Risk', color: '#a855f7', animation: 'animate-shield' },
  { id: 'theta', name: 'Macro', icon: Globe, role: 'Macro', color: '#f97316', animation: 'animate-spin-slow' },
  { id: 'delta', name: 'Booky', icon: BookOpen, role: 'Journal', color: '#3b82f6', animation: 'animate-bounce-subtle' },
];

// All agents map for lookups
const AGENTS_MAP: Record<string, typeof SQUAD_AGENTS[0]> = {};
SQUAD_AGENTS.forEach(a => { AGENTS_MAP[a.id] = a; });

function timeAgo(timestamp: number | Date) {
  const diff = Math.floor((Date.now() - (typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime())) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatDateTime(timestamp: number | Date) {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// Activity Detail Modal
function ActivityDetailModal({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const agent = AGENTS_MAP[activity.agentId];
  const IconComponent = agent?.icon || Info;

  const isBetaWithMetadata = activity.agentId === 'beta' && (activity.metadata as any)?.symbol;
  const betaMetadata = isBetaWithMetadata ? (activity.metadata as unknown as BetaTechMetadata) : null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-card rounded-2xl border border-border ${betaMetadata ? 'max-w-2xl' : 'max-w-md'} w-full p-4 shadow-2xl max-h-[85vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${agent?.animation || ''}`}
              style={{
                backgroundColor: `${agent?.color}20`,
                color: agent?.color,
                boxShadow: `0 0 15px ${agent?.color}30`
              }}
            >
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold" style={{ color: agent?.color }}>{agent?.name || 'Unknown'}</h3>
              <p className="text-xs text-gray-400">{agent?.role || 'Agent'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-card-hover rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {betaMetadata ? (
            <BetaActivityDetail activity={activity} metadata={betaMetadata} />
          ) : (
            <div className="flex items-start gap-2">
              {typeIcons[activity.type]}
              <p className="text-sm text-gray-200 leading-relaxed">{activity.content}</p>
            </div>
          )}

          {/* Tags */}
          {activity.tags && activity.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {activity.tags.map((tag, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-card-hover rounded-full text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDateTime(activity.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Single activity message in the chronological feed
function ActivityMessage({ activity, onClick }: { activity: Activity; onClick: () => void }) {
  const agent = AGENTS_MAP[activity.agentId];
  if (!agent) return null; // Skip unknown agents (like sigma/Prime)

  const IconComponent = agent.icon;

  // Determine message target type
  const getTargetIndicator = () => {
    const tags = activity.tags || [];
    const content = activity.content.toLowerCase();

    // Check if directed at specific agent
    if (content.includes('@prime') || content.includes('@sigma') || tags.includes('Prime')) {
      return { icon: AtSign, label: 'Prime', color: '#10b981' };
    }
    if (content.includes('@risko') || content.includes('@gamma') || tags.includes('Risk')) {
      return { icon: AtSign, label: 'Risko', color: '#a855f7' };
    }
    if (content.includes('@techno') || content.includes('@beta') || tags.includes('Technical')) {
      return { icon: AtSign, label: 'Techno', color: '#4ecdc4' };
    }
    if (content.includes('@professor') || content.includes('@alpha') || tags.includes('Research')) {
      return { icon: AtSign, label: 'Prof', color: '#ff6b6b' };
    }

    // Check if directed at human
    if (tags.includes('Human') || content.includes('user') || content.includes('trader')) {
      return { icon: MessageCircle, label: 'You', color: '#f59e0b' };
    }

    // Default: broadcast to all
    return { icon: Radio, label: 'All', color: '#6b7280' };
  };

  const target = getTargetIndicator();
  const TargetIcon = target.icon;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2 rounded-lg hover:bg-card-hover/70 transition-colors group"
    >
      <div className="flex items-start gap-2">
        {/* Agent Avatar */}
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${agent.animation}`}
          style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
        >
          <IconComponent className="w-3.5 h-3.5" />
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Agent name + target + time */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-semibold" style={{ color: agent.color }}>
              {agent.name}
            </span>
            <span className="text-[9px] text-gray-600">→</span>
            <div className="flex items-center gap-0.5" style={{ color: target.color }}>
              <TargetIcon className="w-2.5 h-2.5" />
              <span className="text-[9px]">{target.label}</span>
            </div>
            <span className="text-[9px] text-gray-600 ml-auto">{timeAgo(activity.timestamp)}</span>
          </div>

          {/* Message */}
          <div className="flex items-start gap-1">
            {typeIcons[activity.type]}
            <p className="text-[11px] text-gray-300 leading-relaxed">
              {activity.content}
            </p>
          </div>

          {/* Tags */}
          {activity.tags && activity.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {activity.tags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="text-[8px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${agent.color}15`, color: agent.color }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function PaperTradeLogItem({ trade }: { trade: PaperTrade }) {
  const isBuy = trade.signal === 'BUY';
  const isOpen = trade.status === 'open';
  const pnlColor = trade.netPnL >= 0 ? 'text-active' : 'text-danger';
  const spanMargin = trade.marginUsed || 0;

  return (
    <div className={`rounded p-2 border ${isOpen ? 'border-accent/30 bg-accent/5' : trade.netPnL >= 0 ? 'border-active/30 bg-active/5' : 'border-danger/30 bg-danger/5'}`}>
      {/* Row 1: Symbol + Signal + P&L */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          {isBuy ? <TrendingUp className="w-3 h-3 text-active" /> : <TrendingDown className="w-3 h-3 text-danger" />}
          <span className="font-bold text-[10px]">{trade.symbol}</span>
          <span className={`text-[9px] px-1 rounded ${isBuy ? 'bg-active/20 text-active' : 'bg-danger/20 text-danger'}`}>
            {trade.signal}
          </span>
        </div>
        {!isOpen && <span className={`text-[9px] font-bold ${pnlColor}`}>{trade.netPnL >= 0 ? '+' : ''}₹{trade.netPnL?.toLocaleString('en-IN')}</span>}
        {isOpen && <span className="text-[9px] text-yellow-500">₹{(spanMargin / 1000).toFixed(0)}K</span>}
      </div>
      {/* Row 2: Futures + Hedge Details */}
      <div className="flex items-center gap-2 text-[9px] text-gray-400">
        <span className="text-blue-400">FUT {trade.futuresLots}×{trade.lotSize} @₹{trade.entryPrice?.toLocaleString('en-IN')}</span>
        <span className="text-purple-400">+{trade.optionLots || 1}×{trade.atmStrike}{trade.optionType}</span>
      </div>
    </div>
  );
}

// Broker Portfolio Component — shows real portfolio from user's broker
function BrokerPortfolio({
  data,
  loading,
}: {
  data: { funds?: any; positions?: any[]; holdings?: any[]; broker?: string; needsBrokerSetup?: boolean; error?: string } | null;
  loading: boolean;
}) {
  if (loading && !data) {
    return (
      <div className="bg-card rounded-2xl border border-border p-3">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-bold">Portfolio</h2>
        </div>
        <div className="text-center py-3 text-gray-500 text-xs">Loading...</div>
      </div>
    );
  }

  if (!data || data.needsBrokerSetup) {
    return (
      <div className="bg-card rounded-2xl border border-border p-3">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-bold">Portfolio</h2>
        </div>
        <div className="text-center py-3">
          <Briefcase className="w-6 h-6 mx-auto text-gray-600 mb-1" />
          <p className="text-xs text-gray-500">{data?.error || 'Connect a broker to see your portfolio'}</p>
        </div>
      </div>
    );
  }

  const funds = data.funds;
  const positions = data.positions || [];
  const holdings = data.holdings || [];
  const broker = (data.broker || '').charAt(0).toUpperCase() + (data.broker || '').slice(1);
  const dayPnl = funds?.dayPnl ?? 0;
  const totalPositionPnl = positions.reduce((sum: number, p: any) => sum + (p.pnl ?? p.realizedProfit ?? p.dayPnl ?? 0), 0);

  return (
    <div className="bg-card rounded-2xl border border-orange-500/20 p-3">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-bold">Portfolio</h2>
          {broker && <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">{broker}</span>}
        </div>
        {funds && (
          <div className={`px-2 py-0.5 rounded ${dayPnl >= 0 ? 'bg-active/10' : 'bg-danger/10'}`}>
            <span className={`text-xs font-bold ${dayPnl >= 0 ? 'text-active' : 'text-danger'}`}>
              {dayPnl >= 0 ? '+' : ''}₹{Math.round(dayPnl).toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </div>

      {/* Funds Stats */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        <div className="text-center p-2 bg-card-hover rounded-lg">
          <div className="text-[10px] text-gray-500 mb-1">Balance</div>
          <div className="text-sm font-bold">
            {funds ? `₹${(funds.totalBalance / 1000).toFixed(0)}K` : '—'}
          </div>
        </div>
        <div className="text-center p-2 bg-card-hover rounded-lg">
          <div className="text-[10px] text-gray-500 mb-1">Available</div>
          <div className="text-sm font-bold text-active">
            {funds ? `₹${(funds.availableBalance / 1000).toFixed(0)}K` : '—'}
          </div>
        </div>
        <div className="text-center p-2 bg-card-hover rounded-lg">
          <div className="text-[10px] text-gray-500 mb-1">Margin Used</div>
          <div className={`text-sm font-bold ${funds && funds.usedMargin > 0 ? 'text-warning' : ''}`}>
            {funds ? `₹${(funds.usedMargin / 1000).toFixed(0)}K` : '—'}
          </div>
        </div>
        <div className="text-center p-2 bg-card-hover rounded-lg">
          <div className="text-[10px] text-gray-500 mb-1">Positions</div>
          <div className="text-sm font-bold text-purple-400">{positions.length}</div>
        </div>
        <div className="text-center p-2 bg-card-hover rounded-lg">
          <div className="text-[10px] text-gray-500 mb-1">Holdings</div>
          <div className="text-sm font-bold">{holdings.length}</div>
        </div>
      </div>

      {/* Open Positions List */}
      {positions.length > 0 && (
        <div className="space-y-1 max-h-[80px] overflow-y-auto mb-2">
          {positions.slice(0, 5).map((p: any, i: number) => {
            const pnl = p.pnl ?? p.realizedProfit ?? p.dayPnl ?? 0;
            const symbol = p.tradingsymbol || p.tradingSymbol || p.dhanSymbol || p.symbol || '—';
            const qty = p.quantity ?? p.netQty ?? 0;
            return (
              <div key={i} className="flex items-center justify-between px-2 py-1 bg-card-hover/50 rounded text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${qty > 0 ? 'bg-active' : 'bg-danger'}`} />
                  <span className="text-white font-medium truncate max-w-[100px]">{symbol}</span>
                  <span className="text-gray-500">{qty > 0 ? `+${qty}` : qty}</span>
                </div>
                <span className={`font-medium ${pnl >= 0 ? 'text-active' : 'text-danger'}`}>
                  {pnl >= 0 ? '+' : ''}₹{Math.round(pnl).toLocaleString('en-IN')}
                </span>
              </div>
            );
          })}
          {positions.length > 5 && (
            <div className="text-center text-[10px] text-gray-500">+{positions.length - 5} more</div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 border-t border-border flex items-center justify-between text-[10px] text-gray-500">
        <span>{positions.length} open position{positions.length !== 1 ? 's' : ''}</span>
        <span>{holdings.length} holding{holdings.length !== 1 ? 's' : ''}</span>
        {totalPositionPnl !== 0 && (
          <span className={totalPositionPnl >= 0 ? 'text-active' : 'text-danger'}>
            P&L: {totalPositionPnl >= 0 ? '+' : ''}₹{Math.round(totalPositionPnl).toLocaleString('en-IN')}
          </span>
        )}
      </div>
    </div>
  );
}

export function ActivityFeed() {
  const { activities, filteredActivities, paperTrades, setPaperTrades, paperPortfolio, setPaperPortfolio } = useDashboardStore();
  const [tradeLogFilter, setTradeLogFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [brokerPortfolio, setBrokerPortfolio] = useState<any>(null);
  const [brokerLoading, setBrokerLoading] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  // Filter out Prime (sigma) activities - Prime communicates via chat panel
  // Sort by timestamp descending (newest first)
  const displayedActivities = filteredActivities()
    .filter(a => a.agentId !== 'sigma')
    .sort((a, b) => {
      const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
      const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

  const filteredPaperTrades = paperTrades.filter((trade) => {
    if (tradeLogFilter === 'all') return true;
    return trade.status === tradeLogFilter;
  }).slice(0, 6);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const headers = getAuthHeaders();
        const [tradesRes, portfolioRes, brokerRes] = await Promise.all([
          fetch(`${apiUrl}/paper-trades?limit=20`, { headers }),
          fetch(`${apiUrl}/paper-portfolio`, { headers }),
          fetch(`${apiUrl}/broker-portfolio`, { headers }).catch(() => null),
        ]);
        if (tradesRes.ok) {
          const data = await tradesRes.json();
          setPaperTrades(data.trades || []);
        }
        if (portfolioRes.ok) {
          const data = await portfolioRes.json();
          setPaperPortfolio(data.portfolio);
        }
        if (brokerRes && brokerRes.ok) {
          const data = await brokerRes.json();
          setBrokerPortfolio(data);
        }
      } catch (err) {
        console.error('Failed to fetch:', err);
      } finally {
        setBrokerLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [setPaperTrades, setPaperPortfolio]);


  return (
    <div className="flex flex-col h-full">
      {/* Live Activity Feed - Chronological message stream */}
      <div className="bg-card rounded-2xl border border-border p-3 flex-1 min-h-0 mb-3 flex flex-col">
        {/* Header with agent indicators */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold">Squad Activity</h2>
            <div className="flex items-center gap-1">
              {SQUAD_AGENTS.map((agent) => {
                const IconComponent = agent.icon;
                const hasActivity = displayedActivities.some(a => a.agentId === agent.id);
                return (
                  <div
                    key={agent.id}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${hasActivity ? agent.animation : 'opacity-40'}`}
                    style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
                    title={`${agent.name} - ${agent.role}`}
                  >
                    <IconComponent className="w-2.5 h-2.5" />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-active animate-pulse" />
            <span className="text-[10px] text-gray-500">LIVE</span>
          </div>
        </div>

        {/* Chronological Message Stream */}
        <div ref={feedRef} className="flex-1 overflow-y-auto min-h-0 space-y-1">
          {displayedActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Radio className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">Squad is quiet...</p>
              <p className="text-[10px] text-gray-600">Activity will appear here as agents work</p>
            </div>
          ) : (
            displayedActivities.slice(0, 20).map((activity) => (
              <ActivityMessage
                key={activity.id}
                activity={activity}
                onClick={() => setSelectedActivity(activity)}
              />
            ))
          )}
        </div>
      </div>

      {/* Paper Trades */}
      <div className="bg-card rounded-2xl border border-border p-2 mb-3">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3 h-3 text-accent" />
            <h2 className="text-xs font-bold">Paper Trades</h2>
          </div>
          <div className="flex gap-0.5">
            {['all', 'open', 'closed'].map((f) => (
              <button
                key={f}
                onClick={() => setTradeLogFilter(f as any)}
                className={`px-1.5 py-0.5 rounded text-[9px] ${tradeLogFilter === f ? 'bg-accent text-white' : 'text-gray-400'}`}
              >
                {f === 'open' ? `${paperTrades.filter(t => t.status === 'open').length}` : f[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1 max-h-[90px] overflow-y-auto">
          {filteredPaperTrades.length === 0 ? (
            <div className="text-center py-2 text-gray-500">
              <Clock className="w-3 h-3 mx-auto mb-1 opacity-50" />
              <p className="text-[10px]">No trades</p>
            </div>
          ) : (
            filteredPaperTrades.map((trade) => (
              <PaperTradeLogItem key={trade.id} trade={trade} />
            ))
          )}
        </div>
      </div>

      {/* Broker Portfolio */}
      <BrokerPortfolio data={brokerPortfolio} loading={brokerLoading} />

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}

    </div>
  );
}
