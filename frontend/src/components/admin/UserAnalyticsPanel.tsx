import { useState, useEffect } from 'react';
import { X, Loader2, TrendingUp, TrendingDown, Activity, BarChart3, Zap, Calendar, Shield, Globe } from 'lucide-react';
import { getAuthHeaders, type User } from '../../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '';

interface UserAnalyticsPanelProps {
  user: User;
  onClose: () => void;
}

interface Analytics {
  user: User;
  momentum: {
    metrics: {
      totalTrades: number;
      winningTrades: number;
      losingTrades: number;
      winRate: number;
      netPnL: number;
      grossProfit: number;
      grossLoss: number;
      avgWin: number;
      avgLoss: number;
      largestWin: number;
      largestLoss: number;
      profitFactor: number;
      sharpeRatio: number;
      sortinoRatio: number;
      calmarRatio: number;
      maxDrawdown: number;
      maxDrawdownAmount: number;
      expectancy: number;
      totalReturn: number;
      annualizedReturn: number;
      avgTradeDuration: number;
      bestPerformingSymbol: string;
      worstPerformingSymbol: string;
      eligibleForLive: boolean;
      tradesRemaining: number;
      recommendations: string[];
    } | null;
    portfolio: {
      capital: number;
      startingCapital: number;
      availableCapital: number;
      totalPnl: number;
      openPositions: number;
      closedTrades: number;
      winRate: number;
      maxDrawdown: number;
    } | null;
  };
  niftyStraddle: {
    capital: {
      initialCapital: number;
      currentCapital: number;
      totalPnl: number;
      totalTrades: number;
      winningTrades: number;
      winRate: number;
      maxDrawdownPct: number;
    } | null;
    engineRunning: boolean;
  };
}

export function UserAnalyticsPanel({ user, onClose }: UserAnalyticsPanelProps) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(user.email)}/analytics`, {
          headers: { ...getAuthHeaders() },
        });
        if (res.ok) {
          setData(await res.json());
        } else {
          setError('Failed to load analytics');
        }
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [user.email]);

  const pnlColor = (v: number) => v > 0 ? 'text-active' : v < 0 ? 'text-danger' : 'text-gray-400';
  const pnlBg = (v: number) => v > 0 ? 'bg-active/10' : v < 0 ? 'bg-danger/10' : 'bg-card-hover';
  const fmt = (v: number, decimals = 2) => v?.toFixed(decimals) ?? '—';
  const fmtCurrency = (v: number) => v != null ? `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-lg bg-background border-l border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">{user.username}</h2>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-card-hover transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : error ? (
            <div className="text-center py-20 text-gray-500">{error}</div>
          ) : data ? (
            <>
              {/* Account Info */}
              <Section title="Account Info" icon={<Shield className="w-4 h-4" />}>
                <div className="grid grid-cols-2 gap-3">
                  <InfoCard label="Role" value={user.role} accent />
                  <InfoCard label="Plan" value={`${user.plan || 'None'} (${user.planStatus || '—'})`} />
                  <InfoCard label="Registered" value={new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                  <InfoCard label="Last Active" value={user.lastActive ? timeAgo(user.lastActive) : user.lastLogin ? timeAgo(user.lastLogin) : 'Never'} />
                  <InfoCard label="Broker" value={getBrokerLabel(user)} />
                  <InfoCard label="Live Trading" value={user.liveTradingEnabled ? 'Enabled' : 'Disabled'} positive={user.liveTradingEnabled} />
                  {user.trialEndsAt && (
                    <InfoCard label="Trial Ends" value={new Date(user.trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                  )}
                  {user.capitalLimit != null && (
                    <InfoCard label="Capital Limit" value={fmtCurrency(user.capitalLimit)} />
                  )}
                </div>
              </Section>

              {/* Momentum Trading */}
              <Section title="Momentum Trading" icon={<Activity className="w-4 h-4" />}>
                {data.momentum.metrics ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <KpiCard label="Total Trades" value={data.momentum.metrics.totalTrades.toString()} />
                      <KpiCard label="Win Rate" value={`${fmt(data.momentum.metrics.winRate, 1)}%`} positive={data.momentum.metrics.winRate >= 50} />
                      <KpiCard label="Net P&L" value={fmtCurrency(data.momentum.metrics.netPnL)} pnl={data.momentum.metrics.netPnL} />
                      <KpiCard label="Profit Factor" value={fmt(data.momentum.metrics.profitFactor)} positive={data.momentum.metrics.profitFactor >= 1} />
                      <KpiCard label="Sharpe" value={fmt(data.momentum.metrics.sharpeRatio)} positive={data.momentum.metrics.sharpeRatio > 0} />
                      <KpiCard label="Sortino" value={fmt(data.momentum.metrics.sortinoRatio)} positive={data.momentum.metrics.sortinoRatio > 0} />
                      <KpiCard label="Max DD" value={`${fmt(data.momentum.metrics.maxDrawdown, 1)}%`} negative />
                      <KpiCard label="Avg Win" value={fmtCurrency(data.momentum.metrics.avgWin)} positive />
                      <KpiCard label="Avg Loss" value={fmtCurrency(data.momentum.metrics.avgLoss)} negative />
                      <KpiCard label="Largest Win" value={fmtCurrency(data.momentum.metrics.largestWin)} positive />
                      <KpiCard label="Largest Loss" value={fmtCurrency(data.momentum.metrics.largestLoss)} negative />
                      <KpiCard label="Expectancy" value={fmtCurrency(data.momentum.metrics.expectancy)} pnl={data.momentum.metrics.expectancy} />
                      <KpiCard label="Total Return" value={`${fmt(data.momentum.metrics.totalReturn, 1)}%`} pnl={data.momentum.metrics.totalReturn} />
                      <KpiCard label="Annual Return" value={`${fmt(data.momentum.metrics.annualizedReturn, 1)}%`} pnl={data.momentum.metrics.annualizedReturn} />
                      <KpiCard label="Calmar" value={fmt(data.momentum.metrics.calmarRatio)} positive={data.momentum.metrics.calmarRatio > 0} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <InfoCard label="Best Symbol" value={data.momentum.metrics.bestPerformingSymbol || '—'} />
                      <InfoCard label="Worst Symbol" value={data.momentum.metrics.worstPerformingSymbol || '—'} />
                      <InfoCard label="Avg Duration" value={`${Math.round(data.momentum.metrics.avgTradeDuration)} min`} />
                      <InfoCard label="Live Eligible" value={data.momentum.metrics.eligibleForLive ? 'Yes' : `${data.momentum.metrics.tradesRemaining} trades left`} positive={data.momentum.metrics.eligibleForLive} />
                    </div>
                    {data.momentum.metrics.recommendations.length > 0 && (
                      <div className="mt-3 bg-card rounded-lg p-3 border border-border">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Recommendations</div>
                        <ul className="text-xs text-gray-400 space-y-1">
                          {data.momentum.metrics.recommendations.map((r, i) => (
                            <li key={i} className="flex gap-2"><span className="text-accent">-</span> {r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState text="No momentum trading data yet" />
                )}
              </Section>

              {/* Portfolio */}
              <Section title="Portfolio State" icon={<BarChart3 className="w-4 h-4" />}>
                {data.momentum.portfolio ? (
                  <div className="grid grid-cols-2 gap-3">
                    <KpiCard label="Capital" value={fmtCurrency(data.momentum.portfolio.capital)} />
                    <KpiCard label="Starting" value={fmtCurrency(data.momentum.portfolio.startingCapital)} />
                    <KpiCard label="Total P&L" value={fmtCurrency(data.momentum.portfolio.totalPnl)} pnl={data.momentum.portfolio.totalPnl} />
                    <KpiCard label="Available" value={fmtCurrency(data.momentum.portfolio.availableCapital)} />
                    <KpiCard label="Open Positions" value={data.momentum.portfolio.openPositions.toString()} />
                    <KpiCard label="Closed Trades" value={data.momentum.portfolio.closedTrades.toString()} />
                  </div>
                ) : (
                  <EmptyState text="No portfolio data yet" />
                )}
              </Section>

              {/* Nifty Straddle */}
              <Section title="Nifty Straddle" icon={<Zap className="w-4 h-4" />}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    data.niftyStraddle.engineRunning ? 'bg-active/10 text-active border border-active/30' : 'bg-gray-700 text-gray-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${data.niftyStraddle.engineRunning ? 'bg-active' : 'bg-gray-500'}`} />
                    Engine {data.niftyStraddle.engineRunning ? 'Running' : 'Stopped'}
                  </span>
                </div>
                {data.niftyStraddle.capital ? (
                  <div className="grid grid-cols-2 gap-3">
                    <KpiCard label="Initial Capital" value={fmtCurrency(data.niftyStraddle.capital.initialCapital)} />
                    <KpiCard label="Current Capital" value={fmtCurrency(data.niftyStraddle.capital.currentCapital)} />
                    <KpiCard label="Total P&L" value={fmtCurrency(data.niftyStraddle.capital.totalPnl)} pnl={data.niftyStraddle.capital.totalPnl} />
                    <KpiCard label="Total Trades" value={data.niftyStraddle.capital.totalTrades.toString()} />
                    <KpiCard label="Win Rate" value={`${fmt(data.niftyStraddle.capital.winRate, 1)}%`} positive={data.niftyStraddle.capital.winRate >= 50} />
                    <KpiCard label="Max DD" value={`${fmt(data.niftyStraddle.capital.maxDrawdownPct, 1)}%`} negative />
                  </div>
                ) : (
                  <EmptyState text="No straddle data yet" />
                )}
              </Section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent">{icon}</span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, pnl, positive, negative }: {
  label: string;
  value: string;
  pnl?: number;
  positive?: boolean;
  negative?: boolean;
}) {
  let valueColor = 'text-white';
  let bg = 'bg-card';
  if (pnl !== undefined) {
    valueColor = pnl > 0 ? 'text-active' : pnl < 0 ? 'text-danger' : 'text-gray-400';
    bg = pnl > 0 ? 'bg-active/5' : pnl < 0 ? 'bg-danger/5' : 'bg-card';
  } else if (positive) {
    valueColor = 'text-active';
  } else if (negative) {
    valueColor = 'text-danger';
  }

  return (
    <div className={`${bg} border border-border rounded-lg p-3`}>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-base font-bold mt-0.5 ${valueColor}`}>{value}</div>
    </div>
  );
}

function InfoCard({ label, value, accent, positive }: {
  label: string;
  value: string;
  accent?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-medium mt-0.5 ${accent ? 'text-accent' : positive ? 'text-active' : positive === false ? 'text-gray-500' : 'text-gray-200'}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 text-center">
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getBrokerLabel(user: User): string {
  const brokers: string[] = [];
  if (user.hasDhanCredentials) brokers.push('Dhan');
  if (user.hasZerodhaCredentials) brokers.push('Zerodha');
  if (user.hasMotilalCredentials) brokers.push('Motilal');
  return brokers.length > 0 ? brokers.join(', ') : 'None';
}
