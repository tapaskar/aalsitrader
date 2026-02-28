import { useEffect, useState, useCallback } from 'react';
import {
  Beaker,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Play,
  Pause,
  Wallet,
  BarChart3,
  Clock,
  BookOpen,
  Link2,
  Briefcase,
  Zap,
} from 'lucide-react';
import { useDashboardStore } from '../store/dashboardStore';
import { getAuthHeaders } from '../store/authStore';
import { PaperStatusBadge, PaperModeIndicator, SigmaApprovalBadge } from './PaperStatusBadge';
import { TradeHistory } from './TradeHistory';
import { EquityCurve } from './EquityCurve';
import { TradingRulesPanel } from './TradingRulesPanel';
import { BrokerGuidanceModal } from './BrokerGuidanceModal';
import type { PaperMetrics, PaperPortfolio } from '../types';

interface BrokerPosition {
  tradingsymbol?: string;
  tradingSymbol?: string;
  exchange?: string;
  exchangeSegment?: string;
  quantity?: number;
  netQty?: number;
  average_price?: number;
  buyAvg?: number;
  last_price?: number;
  lastPrice?: number;
  pnl?: number;
  dayPnl?: number;
  realizedProfit?: number;
  unrealizedProfit?: number;
  product?: string;
  productType?: string;
}

interface BrokerHolding {
  tradingsymbol?: string;
  tradingSymbol?: string;
  exchange?: string;
  exchangeSegment?: string;
  quantity?: number;
  totalQty?: number;
  average_price?: number;
  avgCostPrice?: number;
  last_price?: number;
  lastTradedPrice?: number;
  pnl?: number;
}

interface BrokerFunds {
  availableBalance: number;
  usedMargin: number;
  totalBalance: number;
  dayPnl?: number;
}

interface BrokerPortfolioData {
  positions: BrokerPosition[];
  holdings: BrokerHolding[];
  funds?: BrokerFunds | null;
  broker: string | null;
  needsBrokerSetup: boolean;
  error?: string;
  message?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'https://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod';

export function PaperTradingPanel() {
  const {
    paperMode,
    paperPortfolio,
    paperTrades,
    paperMetrics,
    equityCurve,
    pendingApprovals,
    setPaperMode,
    setPaperPortfolio,
    setPaperTrades,
    setPaperMetrics,
    setEquityCurve,
    setPendingApprovals,
  } = useDashboardStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'overview' | 'trades' | 'analytics' | 'rules'>('overview');
  const [showBrokerGuidance, setShowBrokerGuidance] = useState(false);
  const [brokerGuidance, setBrokerGuidance] = useState<any>(null);
  const [liveConfirm, setLiveConfirm] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [brokerPortfolio, setBrokerPortfolio] = useState<BrokerPortfolioData | null>(null);

  const isLive = paperMode.mode === 'live';

  // Fetch all paper trading data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const authHeaders = getAuthHeaders();
      const authFetchOpts = { headers: authHeaders };

      // Fetch mode from server FIRST to avoid stale-mode data fetches
      const modeRes = await fetch(`${API_URL}/paper-mode`, authFetchOpts);
      const modeData = await modeRes.json();

      const serverMode = modeData.mode || paperMode.mode;
      const modeParam = `mode=${serverMode}`;

      if (modeData.mode) {
        setPaperMode({
          mode: modeData.mode,
          enabled: modeData.enabled,
          requireSigmaApproval: modeData.requireSigmaApproval,
          autoTradingEnabled: modeData.autoTradingEnabled ?? false,
        });
      }

      // Now fetch all data using the server-confirmed mode
      const [portfolioRes, tradesRes, metricsRes, curveRes, approvalsRes, brokerRes] = await Promise.all([
        fetch(`${API_URL}/paper-portfolio?${modeParam}`, authFetchOpts),
        fetch(`${API_URL}/paper-trades?limit=100&${modeParam}`, authFetchOpts),
        fetch(`${API_URL}/paper-metrics?${modeParam}`, authFetchOpts),
        fetch(`${API_URL}/paper-equity-curve?days=30&${modeParam}`, authFetchOpts),
        fetch(`${API_URL}/sigma-approvals`, authFetchOpts),
        fetch(`${API_URL}/broker-portfolio`, authFetchOpts).catch(() => null),
      ]);

      const portfolioData = await portfolioRes.json();
      const tradesData = await tradesRes.json();
      const metricsData = await metricsRes.json();
      const curveData = await curveRes.json();
      const approvalsData = await approvalsRes.json();

      if (portfolioData.portfolio) {
        setPaperPortfolio(portfolioData.portfolio);
      }

      if (tradesData.trades) {
        setPaperTrades(tradesData.trades);
      }

      if (metricsData.metrics) {
        setPaperMetrics(metricsData.metrics);
      }

      if (curveData.equityCurve) {
        setEquityCurve(curveData.equityCurve);
      }

      if (approvalsData.pending) {
        setPendingApprovals(approvalsData.pending.filter((a: any) => a.status === 'pending'));
      }

      if (brokerRes && brokerRes.ok) {
        const brokerData = await brokerRes.json();
        setBrokerPortfolio(brokerData);
      }
    } catch (err) {
      console.error('Failed to fetch paper trading data:', err);
      setError('Failed to load AI Trader data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [paperMode.mode, setPaperMode, setPaperPortfolio, setPaperTrades, setPaperMetrics, setEquityCurve, setPendingApprovals]);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Toggle paper mode
  const handleToggleMode = async () => {
    const newMode = paperMode.mode === 'paper' ? 'live' : 'paper';

    // Confirm before switching to live
    if (newMode === 'live' && !liveConfirm) {
      setLiveConfirm(true);
      setModeError(null);
      return;
    }
    setLiveConfirm(false);
    setModeError(null);

    try {
      const authHeaders = getAuthHeaders();
      const res = await fetch(`${API_URL}/paper-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ mode: newMode }),
      });

      const data = await res.json();

      if (res.ok) {
        setPaperMode({ ...paperMode, mode: newMode });
        // Switch to appropriate default tab
        if (newMode === 'live') {
          setActiveTab('portfolio');
        } else {
          setActiveTab('overview');
        }
        // Refresh data for new mode
        fetchData();
      } else if (data.needsBrokerSetup) {
        setBrokerGuidance(data.guidance);
        setShowBrokerGuidance(true);
      } else {
        setModeError(data.error || 'Failed to switch mode. Please try again.');
      }
    } catch (err) {
      console.error('Failed to toggle mode:', err);
      setModeError('Connection error. Please check your internet and try again.');
    }
  };

  // Toggle autonomous auto-trading
  const handleToggleAutoTrading = async () => {
    const newVal = !paperMode.autoTradingEnabled;
    try {
      const authHeaders = getAuthHeaders();
      const res = await fetch(`${API_URL}/paper-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ autoTradingEnabled: newVal }),
      });

      if (res.ok) {
        setPaperMode({ ...paperMode, autoTradingEnabled: newVal });
      }
    } catch (err) {
      console.error('Failed to toggle auto-trading:', err);
    }
  };

  // Toggle sigma approval
  const handleToggleApproval = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const res = await fetch(`${API_URL}/paper-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ requireSigmaApproval: !paperMode.requireSigmaApproval }),
      });

      if (res.ok) {
        setPaperMode({ ...paperMode, requireSigmaApproval: !paperMode.requireSigmaApproval });
      }
    } catch (err) {
      console.error('Failed to toggle approval:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <RefreshCw className="w-8 h-8 mx-auto text-sigma animate-spin mb-4" />
        <p className="text-gray-400">Loading AI Trader data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <AlertCircle className="w-8 h-8 mx-auto text-danger mb-4" />
        <p className="text-danger mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-card-hover hover:bg-border rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const pendingCount = pendingApprovals.length;
  const openTrades = paperTrades.filter(t => t.status === 'open');
  const closedTrades = paperTrades.filter(t => t.status === 'closed');

  // Mode-driven accent color
  const accent = isLive ? 'orange' : 'sigma';
  const accentClass = isLive ? 'text-orange-400' : 'text-sigma';
  const accentBg = isLive ? 'bg-orange-400' : 'bg-sigma';
  const accentBgLight = isLive ? 'bg-orange-500/10' : 'bg-sigma/10';
  const accentBorder = isLive ? 'border-orange-500/30' : 'border-sigma/20';
  const accentRing = isLive ? 'ring-orange-500/30' : 'ring-sigma/30';

  // Mode-driven tabs — rules visible in both modes (tuned in paper, applied in live)
  const tabs = isLive
    ? (['portfolio', 'overview', 'trades', 'analytics', 'rules'] as const)
    : (['overview', 'trades', 'analytics', 'rules'] as const);

  return (
    <div className="space-y-6">
      {/* Header Card — border color shifts with mode */}
      <div className={`bg-card rounded-2xl border ${accentBorder} p-6 transition-colors duration-300`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${accentBgLight} border ${accentBorder} flex items-center justify-center transition-colors duration-300`}>
              {isLive ? (
                <Zap className="w-6 h-6 text-orange-400" />
              ) : (
                <Beaker className="w-6 h-6 text-sigma" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">AI Trader Dashboard</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                  isLive
                    ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30'
                    : 'bg-sigma/20 text-sigma ring-1 ring-sigma/30'
                }`}>
                  {isLive ? 'LIVE' : 'PAPER'}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {isLive
                  ? 'Real money — orders placed via your broker'
                  : 'Practice mode — virtual capital, no real orders'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Mode badges */}
            <PaperStatusBadge
              mode={paperMode.mode}
              enabled={paperMode.enabled}
              requireSigmaApproval={paperMode.requireSigmaApproval}
              pendingApprovals={pendingCount}
              size="md"
            />

            {!isLive && paperMode.requireSigmaApproval && (
              <SigmaApprovalBadge
                status={pendingCount > 0 ? 'pending' : 'idle'}
                tradesApproved={paperMetrics?.winningTrades || 0}
                tradesRejected={paperMetrics ? (paperMetrics.totalTrades - paperMetrics.winningTrades) : 0}
              />
            )}

            {/* Auto-trading toggle */}
            <button
              onClick={handleToggleAutoTrading}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                paperMode.autoTradingEnabled
                  ? isLive
                    ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                    : 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30'
                  : 'bg-card-hover text-gray-500 hover:text-gray-300 ring-1 ring-border'
              }`}
              title={paperMode.autoTradingEnabled ? 'Auto-trading ON — click to disable' : 'Auto-trading OFF — click to enable'}
            >
              <Play size={12} className={paperMode.autoTradingEnabled ? 'fill-current' : ''} />
              <span>Auto</span>
              <span className={`text-xs font-bold ${paperMode.autoTradingEnabled ? '' : 'text-gray-600'}`}>
                {paperMode.autoTradingEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Mode switch button — styled by mode */}
            <button
              onClick={handleToggleMode}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                isLive
                  ? 'bg-sigma/10 text-sigma hover:bg-sigma/20 ring-1 ring-sigma/20'
                  : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 ring-1 ring-orange-500/20'
              }`}
            >
              {isLive ? <Beaker size={14} /> : <Zap size={14} />}
              Switch to {isLive ? 'Paper' : 'Live'}
            </button>

            <button
              onClick={fetchData}
              className="p-2 bg-card-hover hover:bg-border rounded-lg transition-colors"
              title="Refresh data"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Live mode confirmation */}
        {liveConfirm && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-400">Switch to Live Trading?</p>
              <p className="text-xs text-gray-400 mt-1">Real F&O futures orders will be placed using your broker account. This will use actual money.</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleToggleMode}
                  className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Confirm — Go Live
                </button>
                <button
                  onClick={() => { setLiveConfirm(false); setModeError(null); }}
                  className="px-3 py-1.5 bg-card-hover text-gray-400 text-xs font-medium rounded-lg hover:bg-border transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Auto-trading status banner */}
        {paperMode.autoTradingEnabled && !liveConfirm && (
          <div className={`rounded-lg p-3 flex items-center gap-3 mb-4 ${
            isLive
              ? 'bg-amber-500/10 border border-amber-500/30'
              : 'bg-green-500/10 border border-green-500/20'
          }`}>
            <Play size={14} className={`shrink-0 fill-current ${isLive ? 'text-amber-400' : 'text-green-400'}`} />
            <div className="flex-1">
              {isLive ? (
                <p className="text-xs text-amber-400 font-medium">
                  Auto-trading LIVE — Prime will execute real money orders automatically every 15 min during market hours.
                </p>
              ) : (
                <p className="text-xs text-green-400">
                  Auto-trading ON — Prime is scanning every 15 min and entering paper trades automatically.
                </p>
              )}
            </div>
            <button
              onClick={handleToggleAutoTrading}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0"
            >
              Turn OFF
            </button>
          </div>
        )}

        {!paperMode.autoTradingEnabled && !liveConfirm && (
          <div className="bg-card-hover rounded-lg p-3 flex items-center gap-3 mb-4 border border-border">
            <Pause size={14} className="text-gray-500 shrink-0" />
            <p className="text-xs text-gray-500 flex-1">
              Auto-trading is OFF — Prime only trades when you ask via chat. Toggle <strong>Auto ON</strong> above to let Prime trade autonomously.
            </p>
          </div>
        )}

        {/* Mode switch error */}
        {modeError && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-danger mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-danger">{modeError}</p>
              <button
                onClick={() => setModeError(null)}
                className="text-xs text-gray-400 hover:text-gray-300 mt-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Stats Section — driven by mode */}
        {isLive ? (
          <LivePortfolioStats data={brokerPortfolio} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <StatCard
              icon={<Wallet className="w-4 h-4 text-sigma" />}
              label="Capital"
              value={`₹${(paperPortfolio?.capital || 1000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              subtext={`/${(paperPortfolio?.startingCapital || 1000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4 text-active" />}
              label="Realized P&L"
              value={
                <span className={paperPortfolio?.totalPnl && paperPortfolio.totalPnl >= 0 ? 'text-active' : 'text-danger'}>
                  {paperPortfolio?.totalPnl && paperPortfolio.totalPnl >= 0 ? '+' : ''}
                  ₹{(paperPortfolio?.totalPnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              }
              subtext={paperMetrics?.totalReturn ? `${paperMetrics.totalReturn.toFixed(1)}%` : '0%'}
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4 text-warning" />}
              label="Unrealized P&L"
              value={
                <span className={(paperPortfolio?.unrealizedPnl ?? 0) >= 0 ? 'text-active' : 'text-danger'}>
                  {(paperPortfolio?.unrealizedPnl ?? 0) >= 0 ? '+' : ''}
                  ₹{(paperPortfolio?.unrealizedPnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              }
              subtext={openTrades.length > 0 ? `${openTrades.length} open` : 'No positions'}
              highlight={openTrades.length > 0 && (paperPortfolio?.unrealizedPnl ?? 0) !== 0}
            />
            <StatCard
              icon={<Target className="w-4 h-4 text-warning" />}
              label="Win Rate"
              value={`${paperMetrics?.winRate || 0}%`}
              subtext={`${paperMetrics?.winningTrades || 0}/${paperMetrics?.totalTrades || 0} wins`}
            />
            <StatCard
              icon={<BarChart3 className="w-4 h-4 text-active" />}
              label="Sharpe Ratio"
              value={`${paperMetrics?.sharpeRatio?.toFixed(2) || '0.00'}`}
              subtext={paperMetrics?.sharpeRatio && paperMetrics.sharpeRatio > 1 ? 'Good' : 'N/A'}
            />
            <StatCard
              icon={<TrendingDown className="w-4 h-4 text-danger" />}
              label="Max Drawdown"
              value={`${paperMetrics?.maxDrawdown?.toFixed(1) || 0}%`}
              subtext={`₹${(paperMetrics?.maxDrawdownAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            />
            <div className={`bg-card-hover rounded-xl p-3 ${openTrades.length > 0 ? 'ring-1 ring-sigma/30' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-sigma" />
                <span className="text-xs text-gray-500">Positions</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-semibold text-sigma">{openTrades.length}</span>
                  <span className="text-[10px] text-gray-500 uppercase">Open</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-semibold text-gray-400">{closedTrades.length}</span>
                  <span className="text-[10px] text-gray-500 uppercase">Closed</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs — mode-driven */}
      <div className="flex items-center gap-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
              activeTab === tab
                ? accentClass
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === 'rules' && <BookOpen className="w-3.5 h-3.5" />}
            {tab === 'portfolio' && <Briefcase className="w-3.5 h-3.5" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activeTab === tab && (
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${accentBg}`} />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Portfolio tab — live mode only */}
        {activeTab === 'portfolio' && isLive && (
          <LivePortfolioDetail data={brokerPortfolio} />
        )}

        {activeTab === 'overview' && (
          <>
            {/* Equity Curve — in live mode use broker balance as starting reference */}
            <EquityCurve
              data={equityCurve}
              startingCapital={
                isLive
                  ? (brokerPortfolio?.funds?.totalBalance || brokerPortfolio?.funds?.availableBalance || 0)
                  : (paperPortfolio?.startingCapital || 1000000)
              }
              isLive={isLive}
            />

            {/* Recent Trades Preview */}
            <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Recent Trades</h3>
                <button
                  onClick={() => setActiveTab('trades')}
                  className={`text-sm ${accentClass} hover:underline`}
                >
                  View all →
                </button>
              </div>
              <TradeHistory trades={paperTrades.slice(0, 10)} limit={10} showFilters={false} />
            </div>
          </>
        )}

        {activeTab === 'trades' && (
          <TradeHistory trades={paperTrades} limit={100} showFilters={true} />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView metrics={paperMetrics} portfolio={paperPortfolio} />
        )}

        {activeTab === 'rules' && (
          <TradingRulesPanel />
        )}
      </div>

      {/* Broker Guidance Modal */}
      {showBrokerGuidance && (
        <BrokerGuidanceModal
          onClose={() => setShowBrokerGuidance(false)}
          onRetry={() => {
            setShowBrokerGuidance(false);
            handleToggleMode();
          }}
          guidance={brokerGuidance}
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  highlight = false
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  subtext?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-card-hover rounded-xl p-3 ${highlight ? 'ring-1 ring-sigma/30' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-base font-semibold">{value}</div>
      {subtext && (
        <div className="text-xs text-gray-500 mt-0.5">{subtext}</div>
      )}
    </div>
  );
}

function AnalyticsView({
  metrics,
  portfolio
}: {
  metrics: PaperMetrics | null;
  portfolio: PaperPortfolio | null;
}) {
  if (!metrics) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center text-gray-500">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>Not enough data for analytics yet. Complete more trades to see detailed metrics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricItem label="Total Trades" value={metrics.totalTrades ?? 0} />
          <MetricItem label="Winning Trades" value={metrics.winningTrades ?? 0} color="text-active" />
          <MetricItem label="Losing Trades" value={metrics.losingTrades ?? 0} color="text-danger" />
          <MetricItem label="Win Rate" value={`${metrics.winRate ?? 0}%`} />
          <MetricItem label="Profit Factor" value={(metrics.profitFactor ?? 0).toFixed(2)} />
          <MetricItem label="Average Win" value={`₹${(metrics.avgWin ?? 0).toLocaleString()}`} color="text-active" />
          <MetricItem label="Average Loss" value={`₹${(metrics.avgLoss ?? 0).toLocaleString()}`} color="text-danger" />
          <MetricItem label="Largest Win" value={`₹${(metrics.largestWin ?? 0).toLocaleString()}`} color="text-active" />
          <MetricItem label="Largest Loss" value={`₹${Math.abs(metrics.largestLoss ?? 0).toLocaleString()}`} color="text-danger" />
          <MetricItem label="Sharpe Ratio" value={(metrics.sharpeRatio ?? 0).toFixed(2)} />
          <MetricItem label="Sortino Ratio" value={(metrics.sortinoRatio ?? 0).toFixed(2)} />
          <MetricItem label="Calmar Ratio" value={(metrics.calmarRatio ?? 0).toFixed(2)} />
        </div>
      </div>

      {/* Live Trading Readiness */}
      <div className={`rounded-2xl border p-6 ${
        metrics.eligibleForLive
          ? 'bg-active/5 border-active/20'
          : 'bg-warning/5 border-warning/20'
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            metrics.eligibleForLive ? 'bg-active/10' : 'bg-warning/10'
          }`}>
            {metrics.eligibleForLive ? (
              <ShieldCheck className="w-5 h-5 text-active" />
            ) : (
              <Clock className="w-5 h-5 text-warning" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {metrics.eligibleForLive ? 'Ready for Live Trading' : 'Paper Trading in Progress'}
            </h3>
            <p className="text-sm text-gray-500">
              {metrics.eligibleForLive
                ? 'Your strategy meets all criteria for live trading'
                : `Complete ${metrics.tradesRemaining} more trades to qualify`}
            </p>
          </div>
        </div>

        {metrics.recommendations && metrics.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-400">Recommendations:</h4>
            <ul className="space-y-1">
              {metrics.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className={rec.includes('✅') ? 'text-active' : rec.includes('⚠️') ? 'text-warning' : 'text-sigma'}>
                    {rec.includes('✅') ? '✓' : rec.includes('⚠️') ? '!' : '•'}
                  </span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Strategy Insights */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Strategy Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InsightCard
            label="Best Performing Symbol"
            value={metrics.bestPerformingSymbol || 'N/A'}
            type="positive"
          />
          <InsightCard
            label="Worst Performing Symbol"
            value={metrics.worstPerformingSymbol || 'N/A'}
            type="negative"
          />
          <InsightCard
            label="Average Trade Duration"
            value={metrics.avgTradeDuration ? `${metrics.avgTradeDuration} minutes` : 'N/A'}
            type="neutral"
          />
          <InsightCard
            label="Expectancy per Trade"
            value={`₹${Math.round(metrics.expectancy || 0).toLocaleString()}`}
            type={(metrics.expectancy || 0) >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </div>
    </div>
  );
}

function MetricItem({
  label,
  value,
  color = 'text-white'
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-card-hover rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function InsightCard({
  label,
  value,
  type
}: {
  label: string;
  value: string;
  type: 'positive' | 'negative' | 'neutral';
}) {
  const colors = {
    positive: 'border-active/20 text-active',
    negative: 'border-danger/20 text-danger',
    neutral: 'border-gray-500/20 text-gray-400',
  };

  return (
    <div className={`bg-card-hover rounded-lg p-4 border ${colors[type]}`}>
      <div className="text-xs mb-1">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

// ─── Live Portfolio Stats (summary cards in header) ─────────────────────────

function LivePortfolioStats({ data }: { data: BrokerPortfolioData | null }) {
  if (!data || data.needsBrokerSetup) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Link2 className="w-7 h-7 text-orange-400 mb-2" />
        <p className="text-sm text-gray-400 mb-1">
          {data?.error || 'Connect your broker to trade live'}
        </p>
        {data?.needsBrokerSetup ? (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Go to Profile → Settings to add your broker credentials
            </p>
            <a
              href="/settings"
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('navigate', { detail: 'settings' }));
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
            >
              <Link2 className="w-4 h-4" />
              Configure Broker
            </a>
          </>
        ) : (
          <p className="text-xs text-gray-500">Broker portfolio data is temporarily unavailable</p>
        )}
      </div>
    );
  }

  if (data.error && !data.needsBrokerSetup) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <AlertCircle className="w-7 h-7 text-amber-400 mb-2" />
        <p className="text-sm text-gray-400 mb-1">{data.error}</p>
        <p className="text-xs text-gray-500">{data.message || 'Your broker is connected. Portfolio data will refresh shortly.'}</p>
      </div>
    );
  }

  const positions = data.positions || [];
  const holdings = data.holdings || [];
  const funds = data.funds;
  const brokerLabel = (data.broker || '').charAt(0).toUpperCase() + (data.broker || '').slice(1);

  const totalPositionPnl = positions.reduce((sum, p) => {
    const pnl = p.pnl ?? p.realizedProfit ?? p.dayPnl ?? 0;
    return sum + pnl;
  }, 0);

  const dayPnl = funds?.dayPnl ?? totalPositionPnl;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      <StatCard
        icon={<Wallet className="w-4 h-4 text-orange-400" />}
        label="Total Balance"
        value={funds ? `₹${funds.totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
        subtext={brokerLabel}
      />
      <StatCard
        icon={<ShieldCheck className="w-4 h-4 text-active" />}
        label="Available Margin"
        value={funds ? `₹${funds.availableBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
        subtext={funds ? `${((funds.availableBalance / (funds.totalBalance || 1)) * 100).toFixed(0)}% free` : ''}
      />
      <StatCard
        icon={<Target className="w-4 h-4 text-warning" />}
        label="Used Margin"
        value={funds ? `₹${funds.usedMargin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
        subtext={funds ? `${((funds.usedMargin / (funds.totalBalance || 1)) * 100).toFixed(0)}% utilized` : ''}
      />
      <StatCard
        icon={<TrendingUp className="w-4 h-4 text-orange-400" />}
        label="Day P&L"
        value={
          <span className={dayPnl >= 0 ? 'text-active' : 'text-danger'}>
            {dayPnl >= 0 ? '+' : ''}₹{Math.round(dayPnl).toLocaleString('en-IN')}
          </span>
        }
      />
      <StatCard
        icon={<Clock className="w-4 h-4 text-orange-400" />}
        label="Positions"
        value={String(positions.length)}
        subtext="Open"
      />
      <StatCard
        icon={<Briefcase className="w-4 h-4 text-orange-400" />}
        label="Holdings"
        value={String(holdings.length)}
        subtext="Stocks"
      />
      <StatCard
        icon={<BarChart3 className="w-4 h-4 text-orange-400" />}
        label="Position P&L"
        value={
          <span className={totalPositionPnl >= 0 ? 'text-active' : 'text-danger'}>
            {totalPositionPnl >= 0 ? '+' : ''}₹{Math.round(totalPositionPnl).toLocaleString('en-IN')}
          </span>
        }
        subtext="Unrealized"
      />
    </div>
  );
}

// ─── Live Portfolio Detail (full tables, shown in "Portfolio" tab) ───────────

function LivePortfolioDetail({ data }: { data: BrokerPortfolioData | null }) {
  if (!data || data.needsBrokerSetup) {
    return (
      <div className="bg-card rounded-2xl border border-orange-500/20 p-8 text-center">
        <Link2 className="w-10 h-10 mx-auto text-orange-400 mb-3" />
        <p className="text-gray-400 mb-1">
          {data?.error || (data?.needsBrokerSetup ? 'No broker connected' : 'Portfolio data unavailable')}
        </p>
        <p className="text-xs text-gray-500">
          {data?.needsBrokerSetup
            ? 'Go to Profile → Settings to add your broker credentials'
            : 'Your broker is connected. Data will refresh shortly.'}
        </p>
      </div>
    );
  }

  if (data.error && !data.needsBrokerSetup) {
    return (
      <div className="bg-card rounded-2xl border border-amber-500/20 p-8 text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-amber-400 mb-3" />
        <p className="text-gray-400 mb-1">{data.error}</p>
        <p className="text-xs text-gray-500">{data.message || 'Your broker is connected. Portfolio data will refresh shortly.'}</p>
      </div>
    );
  }

  const positions = data.positions || [];
  const holdings = data.holdings || [];

  if (positions.length === 0 && holdings.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <Briefcase className="w-10 h-10 mx-auto text-gray-500 mb-3" />
        <p className="text-gray-400">No open positions or holdings right now</p>
        <p className="text-xs text-gray-500 mt-1">Your broker positions will appear here during market hours</p>
      </div>
    );
  }

  const funds = data.funds;

  return (
    <div className="space-y-6">
      {/* Funds Summary */}
      {funds && (
        <div className="bg-card rounded-2xl border border-orange-500/20 p-4 md:p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-orange-400" />
            Account Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card-hover rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Total Balance</div>
              <div className="text-lg font-bold">₹{funds.totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-card-hover rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Available Margin</div>
              <div className="text-lg font-bold text-active">₹{funds.availableBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-card-hover rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Used Margin</div>
              <div className="text-lg font-bold text-warning">₹{funds.usedMargin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-card-hover rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Day P&L</div>
              <div className={`text-lg font-bold ${(funds.dayPnl ?? 0) >= 0 ? 'text-active' : 'text-danger'}`}>
                {(funds.dayPnl ?? 0) >= 0 ? '+' : ''}₹{Math.round(funds.dayPnl ?? 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Positions table */}
      {positions.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" />
            Open Positions
            <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full">{positions.length}</span>
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 bg-card-hover">
                  <th className="text-left py-2.5 px-3">Symbol</th>
                  <th className="text-right py-2.5 px-3">Qty</th>
                  <th className="text-right py-2.5 px-3">Avg Price</th>
                  <th className="text-right py-2.5 px-3">LTP</th>
                  <th className="text-right py-2.5 px-3">P&L</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, i) => {
                  const symbol = pos.tradingsymbol || pos.tradingSymbol || '—';
                  const qty = pos.quantity ?? pos.netQty ?? 0;
                  const avg = pos.average_price ?? pos.buyAvg ?? 0;
                  const ltp = pos.last_price ?? pos.lastPrice ?? 0;
                  const pnl = pos.pnl ?? pos.realizedProfit ?? (ltp - avg) * qty;
                  return (
                    <tr key={i} className="border-t border-border/30 hover:bg-card-hover/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium">{symbol}</td>
                      <td className={`py-2.5 px-3 text-right ${qty >= 0 ? 'text-active' : 'text-danger'}`}>{qty}</td>
                      <td className="py-2.5 px-3 text-right text-gray-400">₹{avg.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right">₹{ltp.toFixed(2)}</td>
                      <td className={`py-2.5 px-3 text-right font-medium ${pnl >= 0 ? 'text-active' : 'text-danger'}`}>
                        {pnl >= 0 ? '+' : ''}₹{Math.round(pnl).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Holdings table */}
      {holdings.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-orange-400" />
            Holdings
            <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full">{holdings.length}</span>
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 bg-card-hover">
                  <th className="text-left py-2.5 px-3">Symbol</th>
                  <th className="text-right py-2.5 px-3">Qty</th>
                  <th className="text-right py-2.5 px-3">Avg Price</th>
                  <th className="text-right py-2.5 px-3">LTP</th>
                  <th className="text-right py-2.5 px-3">P&L</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => {
                  const symbol = h.tradingsymbol || h.tradingSymbol || '—';
                  const qty = h.quantity ?? h.totalQty ?? 0;
                  const avg = h.average_price ?? h.avgCostPrice ?? 0;
                  const ltp = h.last_price ?? h.lastTradedPrice ?? 0;
                  const pnl = h.pnl ?? (ltp - avg) * qty;
                  return (
                    <tr key={i} className="border-t border-border/30 hover:bg-card-hover/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium">{symbol}</td>
                      <td className="py-2.5 px-3 text-right">{qty}</td>
                      <td className="py-2.5 px-3 text-right text-gray-400">₹{avg.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right">₹{ltp.toFixed(2)}</td>
                      <td className={`py-2.5 px-3 text-right font-medium ${pnl >= 0 ? 'text-active' : 'text-danger'}`}>
                        {pnl >= 0 ? '+' : ''}₹{Math.round(pnl).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
