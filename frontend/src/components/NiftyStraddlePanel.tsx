import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Play,
  Square,
  Wifi,
  WifiOff,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { getAuthHeaders } from '../store/authStore';
import { BrokerGuidanceModal } from './BrokerGuidanceModal';

const API_URL = import.meta.env.VITE_API_URL || 'https://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod';

type BrokerName = 'dhan' | 'zerodha' | 'motilal' | 'angelone' | 'upstox';
type IndexName = 'NIFTY' | 'BANKNIFTY';
type StrategyType = 'short_straddle' | 'short_strangle' | 'iron_condor';

const BROKER_LABELS: Record<BrokerName, string> = {
  dhan: 'DhanHQ',
  zerodha: 'Zerodha Kite',
  motilal: 'Motilal MOTS',
  angelone: 'AngelOne',
  upstox: 'Upstox',
};

const INDEX_LABELS: Record<IndexName, string> = {
  NIFTY: 'Nifty 50',
  BANKNIFTY: 'Bank Nifty',
};

const STRATEGY_LABELS: Record<string, string> = {
  short_straddle: 'Short Straddle',
  short_strangle: 'Short Strangle',
  iron_condor: 'Iron Condor',
};

interface LegDetail {
  side: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  strikePrice: number;
  entryPremium: number;
  curPremium: number;
  delta: number;
  instrumentId?: string;
  orderId?: string;
}

interface ExitRules {
  perLegSlPct: number | null;
  combinedSlPct: number;
  profitTargetPct: number;
}

interface EngineStatus {
  broker: { connected: boolean; name?: BrokerName; label?: string };
  market: { isOpen: boolean; istTime?: string };
  engine: {
    running: boolean;
    mode: 'paper' | 'live';
    broker?: BrokerName;
    indexName?: IndexName;
    strategyType?: StrategyType;
    lastSpot?: number;
    lastNiftySpot?: number;
    lastUpdate?: string;
  };
}

interface Capital {
  initialCapital: number;
  currentCapital: number;
  totalPnl: number;
  maxDrawdownPct: number;
  winRate: number;
  totalTrades: number;
}

interface Position {
  id: string;
  indexName?: IndexName;
  strategyType?: StrategyType;
  strategyLabel?: string;
  legs?: LegDetail[];
  exitRules?: ExitRules;
  ceStrike: number;
  peStrike: number;
  ceEntryPremium: number;
  peEntryPremium: number;
  ceCurPremium: number;
  peCurPremium: number;
  ceDelta: number;
  peDelta: number;
  totalCollected: number;
  totalCurrent: number;
  unrealizedPnl: number;
  niftyEntry: number;
  entryTime: string;
  mode: 'paper' | 'live';
  broker?: BrokerName;
  ceOrderId?: string;
  peOrderId?: string;
  marginRequired?: number;
  netMarginRequired?: number;
  capitalUtilization?: number;
}

interface Trade {
  id: string;
  tradeDate: string;
  strategyType: string;
  indexName?: IndexName;
  entryTime: string;
  exitTime: string;
  ceEntryPremium: number;
  peEntryPremium: number;
  ceExitPremium: number;
  peExitPremium: number;
  netPnl: number;
  grossPnl?: number;
  exitReason: string;
  mode: 'paper' | 'live';
  broker?: BrokerName;
  ceStrike?: number;
  peStrike?: number;
  niftyEntry?: number;
  niftyExit?: number;
  marginRequired?: number;
  netMarginRequired?: number;
  totalCollected?: number;
  totalAtExit?: number;
  lotSize?: number;
  lots?: number;
  legs?: LegDetail[];
  ceInstrumentId?: string;
  peInstrumentId?: string;
  ceOrderId?: string;
  peOrderId?: string;
  ceExitOrderId?: string;
  peExitOrderId?: string;
}

export function NiftyStraddlePanel() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [capital, setCapital] = useState<Capital | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modeConfirm, setModeConfirm] = useState(false);
  const [showBrokerGuidance, setShowBrokerGuidance] = useState(false);
  const [brokerGuidance, setBrokerGuidance] = useState<any>(null);
  const [brokerFunds, setBrokerFunds] = useState<{ availableBalance: number; usedMargin: number; totalBalance: number; dayPnl?: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getAuthHeaders();
      const [sRes, cRes, curRes, tRes, brokerRes] = await Promise.all([
        fetch(`${API_URL}/nifty-straddle/status`, { headers }),
        fetch(`${API_URL}/nifty-straddle/capital`, { headers }),
        fetch(`${API_URL}/nifty-straddle/current`, { headers }),
        fetch(`${API_URL}/nifty-straddle/trades`, { headers }),
        fetch(`${API_URL}/broker-portfolio`, { headers }).catch(() => null),
      ]);
      const [sData, cData, curData, tData] = await Promise.all([
        sRes.json(), cRes.json(), curRes.json(), tRes.json(),
      ]);
      setStatus(sData);
      setCapital(cData);
      setPosition(curData.position ?? null);
      setTrades(tData.trades ?? []);

      if (brokerRes && brokerRes.ok) {
        const brokerData = await brokerRes.json();
        setBrokerFunds(brokerData.funds ?? null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const pollLive = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [sRes, curRes] = await Promise.all([
        fetch(`${API_URL}/nifty-straddle/status`, { headers }),
        fetch(`${API_URL}/nifty-straddle/current`, { headers }),
      ]);
      const [sData, curData] = await Promise.all([sRes.json(), curRes.json()]);
      setStatus(sData);
      const newPosition = curData.position ?? null;
      // If position just closed (was open, now null), refresh capital + trades
      setPosition(prev => {
        if (prev && !newPosition) {
          // Trade just closed — trigger full data refresh
          setTimeout(() => fetchAll(), 500);
        }
        return newPosition;
      });
    } catch {
      // silent
    }
  }, [fetchAll]);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(pollLive, 10_000);
    return () => clearInterval(pollRef.current);
  }, [fetchAll, pollLive]);

  async function handleStart() {
    setError(null);
    try {
      await fetch(`${API_URL}/nifty-straddle/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: '{}',
      });
      await fetchAll();
    } catch (e: any) { setError(e.message); }
  }

  async function handleStop() {
    setError(null);
    try {
      await fetch(`${API_URL}/nifty-straddle/stop`, { method: 'POST', headers: getAuthHeaders() });
      await fetchAll();
    } catch (e: any) { setError(e.message); }
  }

  async function handleToggleMode() {
    if (!status) return;
    const newMode = status.engine.mode === 'paper' ? 'live' : 'paper';
    if (newMode === 'live' && !modeConfirm) {
      setModeConfirm(true);
      return;
    }
    setModeConfirm(false);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/nifty-straddle/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ mode: newMode }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.needsBrokerSetup) {
          setBrokerGuidance(data.guidance);
          setShowBrokerGuidance(true);
          return;
        }
        throw new Error(data.error || 'Failed to toggle mode');
      }
      await fetchAll();
    } catch (e: any) { setError(e.message); }
  }

  async function handleFilter() {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const qs = params.toString();
      const res = await fetch(`${API_URL}/nifty-straddle/trades${qs ? '?' + qs : ''}`, { headers: getAuthHeaders() });
      const data = await res.json();
      setTrades(data.trades ?? []);
    } catch (e: any) { setError(e.message); }
  }

  const engineRunning = status?.engine?.running ?? false;
  const mode = status?.engine?.mode ?? 'paper';
  const broker: BrokerName = status?.engine?.broker ?? 'dhan';
  const brokerLabel = BROKER_LABELS[broker] || broker;
  const indexName: IndexName = status?.engine?.indexName ?? 'NIFTY';
  const strategyType: StrategyType = status?.engine?.strategyType ?? 'short_straddle';

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Nifty Scalper</h2>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            mode === 'live' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {mode}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Autonomous Badge */}
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-active/10 text-active text-sm font-medium">
            <Zap className="w-3.5 h-3.5" />
            Autonomous
          </span>

          {/* Mode Toggle */}
          <button
            onClick={handleToggleMode}
            disabled={engineRunning}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              engineRunning
                ? 'opacity-40 cursor-not-allowed bg-card-hover text-gray-500'
                : mode === 'paper'
                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
            }`}
            title={engineRunning ? 'Stop engine to toggle mode' : `Switch to ${mode === 'paper' ? 'live' : 'paper'}`}
          >
            {mode === 'paper' ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
            Switch to {mode === 'paper' ? 'Live' : 'Paper'}
          </button>

          {/* Start / Stop */}
          <button
            onClick={handleStart}
            disabled={engineRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              engineRunning
                ? 'opacity-40 cursor-not-allowed bg-active/10 text-active'
                : 'bg-active text-white hover:bg-active/80'
            }`}
          >
            <Play className="w-4 h-4" /> Start
          </button>
          <button
            onClick={handleStop}
            disabled={!engineRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !engineRunning
                ? 'opacity-40 cursor-not-allowed bg-danger/10 text-danger'
                : 'bg-danger text-white hover:bg-danger/80'
            }`}
          >
            <Square className="w-4 h-4" /> Stop
          </button>
        </div>
      </div>

      {/* Live mode confirmation dialog */}
      {modeConfirm && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">Switch to Live Trading?</p>
            <p className="text-xs text-gray-400 mt-1">Real orders will be placed on {brokerLabel}. This will use actual money.</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleToggleMode}
                className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors"
              >
                Confirm — Go Live
              </button>
              <button
                onClick={() => setModeConfirm(false)}
                className="px-3 py-1.5 bg-card-hover text-gray-400 text-xs font-medium rounded-lg hover:bg-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-sm text-danger">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-card-hover rounded-lg p-3 text-sm text-gray-400">Loading...</div>
      )}

      {/* Connection Panel */}
      {status && <ConnectionPanel status={status} />}

      {/* Capital Cards */}
      {capital && <CapitalCards capital={capital} mode={mode} brokerFunds={brokerFunds} />}

      {/* Current Trade */}
      <CurrentTrade position={position} />

      {/* Trade History */}
      <TradeHistorySection
        trades={trades}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onFilter={handleFilter}
      />

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

/* --- Connection Panel --- */

function ConnectionPanel({ status }: { status: EngineStatus }) {
  const brokerLabel = status.broker?.label || BROKER_LABELS[status.broker?.name || 'dhan'] || 'Broker API';
  const items = [
    { label: brokerLabel, ok: status.broker?.connected },
    { label: 'Market Open', ok: status.market?.isOpen },
    { label: 'Engine Running', ok: status.engine?.running },
  ];

  const spotPrice = status.engine?.lastSpot ?? status.engine?.lastNiftySpot;
  const indexLabel = INDEX_LABELS[status.engine?.indexName || 'NIFTY'] || 'Nifty 50';

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-6">
        {items.map(({ label, ok }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-active' : 'bg-danger'}`} />
            <span className="text-sm text-gray-400">{label}</span>
            <span className={`text-xs font-medium ${ok ? 'text-active' : 'text-danger'}`}>
              {ok ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}

        {status.market?.istTime && (
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-sm text-gray-400">IST</span>
            <span className="text-xs font-medium text-white">{status.market.istTime}</span>
          </div>
        )}

        {spotPrice && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-400">{indexLabel}</span>
            <span className="text-lg font-bold text-white">
              {Number(spotPrice).toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* --- Capital Cards --- */

function CapitalCards({ capital, mode, brokerFunds }: {
  capital: Capital;
  mode: 'paper' | 'live';
  brokerFunds: { availableBalance: number; usedMargin: number; totalBalance: number; dayPnl?: number } | null;
}) {
  const pnl = capital.totalPnl ?? 0;
  const isLive = mode === 'live';

  // In live mode, always show broker-appropriate labels (use "—" if funds unavailable)
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const cards = isLive
    ? [
        { label: 'Total Balance', value: brokerFunds ? fmt(brokerFunds.totalBalance) : '—', color: '' },
        { label: 'Available Margin', value: brokerFunds ? fmt(brokerFunds.availableBalance) : '—', color: 'text-active' },
        { label: 'Used Margin', value: brokerFunds ? fmt(brokerFunds.usedMargin) : '—', color: brokerFunds && brokerFunds.usedMargin > 0 ? 'text-warning' : '' },
        { label: 'Scalper P&L', value: `${pnl >= 0 ? '+' : ''}₹${Math.abs(pnl).toLocaleString('en-IN')}`, color: pnl >= 0 ? 'text-active' : 'text-danger' },
        { label: 'Win Rate', value: `${capital.winRate?.toFixed(1) ?? '0.0'}%`, color: '' },
        { label: 'Total Trades', value: String(capital.totalTrades ?? 0), color: '' },
      ]
    : [
        { label: 'Starting Capital', value: `₹${Number(capital.initialCapital).toLocaleString('en-IN')}`, color: '' },
        { label: 'Current Value', value: `₹${Number(capital.currentCapital).toLocaleString('en-IN')}`, color: '' },
        { label: 'Total P&L', value: `${pnl >= 0 ? '+' : ''}₹${Math.abs(pnl).toLocaleString('en-IN')}`, color: pnl >= 0 ? 'text-active' : 'text-danger' },
        { label: 'Max Drawdown', value: `${capital.maxDrawdownPct?.toFixed(1) ?? '0.0'}%`, color: 'text-danger' },
        { label: 'Win Rate', value: `${capital.winRate?.toFixed(1) ?? '0.0'}%`, color: '' },
        { label: 'Total Trades', value: String(capital.totalTrades ?? 0), color: '' },
      ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(({ label, value, color }) => (
        <div key={label} className={`bg-card rounded-xl border ${isLive ? 'border-red-500/20' : 'border-border'} p-4`}>
          <div className="text-xs text-gray-500 mb-1">{label}</div>
          <div className={`text-lg font-bold ${color || 'text-white'}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

/* --- Current Trade --- */

function CurrentTrade({ position }: { position: Position | null }) {
  if (!position) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-bold mb-2">Current Trade</h3>
        <p className="text-sm text-gray-500">No open position.</p>
      </div>
    );
  }

  const p = position;
  const legs = p.legs || [];
  const hasNLegs = legs.length > 0;
  const stratLabel = p.strategyLabel || STRATEGY_LABELS[p.strategyType || ''] || 'Short Straddle';
  const indexLabel = INDEX_LABELS[p.indexName || 'NIFTY'] || 'Nifty 50';
  const exitRules = p.exitRules;

  // Compute profit/loss percentages
  const collected = Math.abs(p.totalCollected);
  const current = p.totalCurrent;
  const profitPct = collected > 0 ? ((collected - current) / collected) * 100 : 0;
  const lossPct = collected > 0 ? ((current - collected) / collected) * 100 : 0;

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Current Trade — {stratLabel}</h3>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400">
            {indexLabel}
          </span>
          {p.broker && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
              {BROKER_LABELS[p.broker] || p.broker}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
            p.mode === 'live' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {p.mode}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <span className="text-gray-500">Entry Time</span>
          <span className="ml-2 text-white">{new Date(p.entryTime).toLocaleTimeString('en-IN')}</span>
        </div>
        <div>
          <span className="text-gray-500">{indexLabel} Entry</span>
          <span className="ml-2 text-white">{p.niftyEntry?.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* N-leg or 2-leg display */}
      <div className={`grid grid-cols-1 ${hasNLegs && legs.length > 2 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'} gap-4 mb-4`}>
        {hasNLegs ? (
          legs.map((leg, i) => (
            <LegCard key={i} leg={leg} indexLabel={indexLabel} />
          ))
        ) : (
          // Fallback: legacy 2-leg display
          [
            { type: 'CE', strike: p.ceStrike, entry: p.ceEntryPremium, cur: p.ceCurPremium, delta: p.ceDelta, orderId: p.ceOrderId, action: 'SELL' as const },
            { type: 'PE', strike: p.peStrike, entry: p.peEntryPremium, cur: p.peCurPremium, delta: p.peDelta, orderId: p.peOrderId, action: 'SELL' as const },
          ].map((leg) => (
            <div key={leg.type} className="bg-card-hover rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-amber-400">{leg.type} {leg.strike}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">SELL</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Entry</span><span>{leg.entry?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Current</span><span>{leg.cur?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Delta</span><span>{leg.delta?.toFixed(4)}</span></div>
                {leg.orderId && (
                  <div className="flex justify-between"><span className="text-gray-500">Order ID</span><span className="text-gray-400">{leg.orderId}</span></div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Unrealized P&L */}
      <div className="flex items-center justify-between text-sm mb-4">
        <span className="text-gray-400">Unrealized P&L</span>
        <span className={`text-lg font-bold ${p.unrealizedPnl >= 0 ? 'text-active' : 'text-danger'}`}>
          {p.unrealizedPnl >= 0 ? '+' : ''}₹{Math.abs(p.unrealizedPnl).toFixed(0)}
        </span>
      </div>

      {/* Margin Info */}
      {p.marginRequired != null && (
        <div className="grid grid-cols-3 gap-3 text-sm mb-4">
          <div>
            <span className="text-gray-500 text-xs block">Margin Required</span>
            <span className="text-white font-medium">₹{Math.round(p.marginRequired).toLocaleString('en-IN')}</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs block">Net Margin</span>
            <span className="text-white font-medium">₹{Math.round(p.netMarginRequired ?? 0).toLocaleString('en-IN')}</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs block">Capital Used</span>
            <span className="text-amber-400 font-medium">{p.capitalUtilization?.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Progress Bars */}
      <div className="space-y-3">
        <ProgressBar
          label={`Profit Target (${exitRules?.profitTargetPct ?? 60}%)`}
          value={Math.max(profitPct, 0)}
          max={exitRules?.profitTargetPct ?? 60}
          color="bg-active"
        />
        <ProgressBar
          label={`Combined SL (${exitRules?.combinedSlPct ?? 70}%)`}
          value={Math.max(lossPct, 0)}
          max={exitRules?.combinedSlPct ?? 70}
          color="bg-danger"
        />
      </div>
    </div>
  );
}

function LegCard({ leg, indexLabel }: { leg: LegDetail; indexLabel: string }) {
  const isSell = leg.action === 'SELL';
  const legPnl = isSell
    ? leg.entryPremium - leg.curPremium
    : leg.curPremium - leg.entryPremium;

  return (
    <div className="bg-card-hover rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-amber-400">{leg.side} {leg.strikePrice}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
          isSell ? 'bg-red-500/20 text-red-400' : 'bg-active/20 text-active'
        }`}>
          {leg.action}
        </span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between"><span className="text-gray-500">Entry</span><span>{leg.entryPremium?.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Current</span><span>{leg.curPremium?.toFixed(2)}</span></div>
        <div className="flex justify-between">
          <span className="text-gray-500">Leg P&L</span>
          <span className={legPnl >= 0 ? 'text-active' : 'text-danger'}>{legPnl >= 0 ? '+' : ''}{legPnl.toFixed(2)}</span>
        </div>
        <div className="flex justify-between"><span className="text-gray-500">Delta</span><span>{leg.delta?.toFixed(4)}</span></div>
        {leg.orderId && (
          <div className="flex justify-between"><span className="text-gray-500">Order</span><span className="text-gray-400 text-[10px]">{leg.orderId}</span></div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-400">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-card-hover overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* --- Trade History --- */

function TradeHistorySection({
  trades, dateFrom, dateTo, onDateFromChange, onDateToChange, onFilter,
}: {
  trades: Trade[];
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onFilter: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="text-lg font-bold mb-4">Trade History</h3>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="bg-card-hover border border-border rounded-lg px-3 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="bg-card-hover border border-border rounded-lg px-3 py-1.5 text-sm text-white"
          />
        </div>
        <button
          onClick={onFilter}
          className="px-4 py-1.5 bg-card-hover hover:bg-border text-sm text-white rounded-lg transition-colors"
        >
          Filter
        </button>
      </div>

      {trades.length === 0 ? (
        <p className="text-sm text-gray-500">No trades found.</p>
      ) : (
        <div className="space-y-2">
          {trades.map((t) => {
            const pnl = parseFloat(String(t.netPnl || 0));
            const isExpanded = expandedId === t.id;
            const stratLabel = STRATEGY_LABELS[t.strategyType || ''] || t.strategyType || 'Straddle';
            const indexLabel = INDEX_LABELS[t.indexName || 'NIFTY'] || '';
            return (
              <div key={t.id} className="border border-border/50 rounded-lg overflow-hidden">
                {/* Summary row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-card-hover transition-colors cursor-pointer"
                >
                  <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </span>
                  <span className="text-sm text-white w-24 shrink-0">{t.tradeDate}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${
                    t.mode === 'live' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {t.mode}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {t.entryTime ? new Date(t.entryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    {' → '}
                    {t.exitTime ? new Date(t.exitTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </span>
                  <span className="text-xs text-gray-500 hidden sm:inline">{stratLabel}</span>
                  {indexLabel && <span className="text-xs text-gray-500 hidden md:inline">{indexLabel}</span>}
                  <span className={`ml-auto text-sm font-bold ${pnl >= 0 ? 'text-active' : 'text-danger'}`}>
                    {pnl >= 0 ? '+' : ''}₹{Math.abs(pnl).toLocaleString('en-IN')}
                  </span>
                  {t.exitReason && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      t.exitReason === 'tp' ? 'bg-active/10 text-active' :
                      t.exitReason === 'time' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-danger/10 text-danger'
                    }`}>
                      {t.exitReason === 'tp' ? 'Target' : t.exitReason === 'time' ? 'Time Exit' : t.exitReason.startsWith('sl') ? 'Stop Loss' : t.exitReason}
                    </span>
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && <TradeDetail trade={t} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --- Trade Detail (expanded) --- */

function TradeDetail({ trade: t }: { trade: Trade }) {
  const qty = (t.lotSize || 25) * (t.lots || 1);
  const grossPnl = t.grossPnl ?? ((t.totalCollected ?? 0) - (t.totalAtExit ?? 0)) * qty;
  const brokerage = grossPnl - (t.netPnl || 0);
  const brokerLabel = t.broker ? (BROKER_LABELS[t.broker] || t.broker) : 'Paper';
  const stratLabel = STRATEGY_LABELS[t.strategyType || ''] || t.strategyType || 'Straddle';
  const isHedged = t.strategyType === 'iron_condor';
  const indexLabel = INDEX_LABELS[t.indexName || 'NIFTY'] || 'Nifty 50';
  const legs = t.legs || [];

  return (
    <div className="px-4 pb-4 pt-1 bg-card-hover/50 border-t border-border/30 space-y-4">
      {/* Contract Legs — N-leg or 2-leg fallback */}
      <div className={`grid grid-cols-1 ${legs.length > 2 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'} gap-3`}>
        {legs.length > 0 ? (
          legs.map((leg, i) => {
            const isSell = leg.action === 'SELL';
            const exitPrem = (leg as any).exitPremium ?? leg.curPremium;
            const legPnl = isSell
              ? (leg.entryPremium - exitPrem) * qty
              : (exitPrem - leg.entryPremium) * qty;
            return (
              <div key={i} className="bg-card rounded-lg p-3 border border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400">{indexLabel} {leg.strikePrice} {leg.side}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    isSell ? 'bg-red-500/20 text-red-400' : 'bg-active/20 text-active'
                  }`}>
                    {leg.action}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Entry Premium</span>
                    <span className="text-white">₹{leg.entryPremium?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Exit Premium</span>
                    <span className="text-white">₹{exitPrem?.toFixed(2) ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Leg P&L</span>
                    <span className={legPnl >= 0 ? 'text-active' : 'text-danger'}>
                      {legPnl >= 0 ? '+' : ''}₹{Math.abs(legPnl).toFixed(0)}
                    </span>
                  </div>
                  {leg.instrumentId && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Instrument</span>
                      <span className="text-gray-400">{leg.instrumentId}</span>
                    </div>
                  )}
                  {leg.orderId && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Order</span>
                      <span className="text-gray-400 font-mono text-[10px]">{leg.orderId}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          /* Fallback: legacy 2-leg detail */
          <>
            <div className="bg-card rounded-lg p-3 border border-border/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-400">{indexLabel} {t.ceStrike || '—'} CE</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">SELL</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Entry</span><span>₹{t.ceEntryPremium?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Exit</span><span>₹{t.ceExitPremium?.toFixed(2) ?? '—'}</span></div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Leg P&L</span>
                  {(() => { const lp = ((t.ceEntryPremium||0)-(t.ceExitPremium||0))*qty; return <span className={lp>=0?'text-active':'text-danger'}>{lp>=0?'+':''}₹{Math.abs(lp).toFixed(0)}</span>; })()}
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-400">{indexLabel} {t.peStrike || '—'} PE</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">SELL</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Entry</span><span>₹{t.peEntryPremium?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Exit</span><span>₹{t.peExitPremium?.toFixed(2) ?? '—'}</span></div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Leg P&L</span>
                  {(() => { const lp = ((t.peEntryPremium||0)-(t.peExitPremium||0))*qty; return <span className={lp>=0?'text-active':'text-danger'}>{lp>=0?'+':''}₹{Math.abs(lp).toFixed(0)}</span>; })()}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Trade Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-gray-500 block">{indexLabel} Entry</span>
          <span className="text-white font-medium">{t.niftyEntry?.toLocaleString('en-IN') ?? '—'}</span>
        </div>
        <div>
          <span className="text-gray-500 block">{indexLabel} Exit</span>
          <span className="text-white font-medium">{t.niftyExit?.toLocaleString('en-IN') ?? '—'}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Entry Time</span>
          <span className="text-white font-medium">{t.entryTime ? new Date(t.entryTime).toLocaleTimeString('en-IN') : '—'}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Exit Time</span>
          <span className="text-white font-medium">{t.exitTime ? new Date(t.exitTime).toLocaleTimeString('en-IN') : '—'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-gray-500 block">Quantity</span>
          <span className="text-white font-medium">{t.lotSize || 25} × {t.lots || 1} = {qty}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Premium Collected</span>
          <span className="text-white font-medium">₹{((t.totalCollected || 0) * qty).toLocaleString('en-IN')}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Gross P&L</span>
          <span className={`font-medium ${grossPnl >= 0 ? 'text-active' : 'text-danger'}`}>
            {grossPnl >= 0 ? '+' : ''}₹{Math.abs(grossPnl).toLocaleString('en-IN')}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block">Brokerage & Charges</span>
          <span className="text-gray-400 font-medium">₹{Math.abs(brokerage).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-gray-500 block">Broker</span>
          <span className="text-white font-medium">{brokerLabel}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Net Margin</span>
          <span className="text-white font-medium">
            {t.netMarginRequired ? `₹${Math.round(t.netMarginRequired).toLocaleString('en-IN')}` : '—'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block">Strategy</span>
          <span className="text-white font-medium">{stratLabel}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Hedge</span>
          <div className="flex items-center gap-1">
            {isHedged ? (
              <span className="text-active font-medium">Hedged</span>
            ) : (
              <span className="text-gray-400 font-medium">Naked</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
