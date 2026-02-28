import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle, Target, Minus, Clock, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import type { PaperTrade } from '../types';

interface TradeHistoryProps {
  trades: PaperTrade[];
  limit?: number;
  showFilters?: boolean;
}

type FilterStatus = 'all' | 'open' | 'closed' | 'win' | 'loss';

export function TradeHistory({ trades, limit = 50, showFilters = true }: TradeHistoryProps) {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredTrades = trades.filter((trade) => {
    switch (filter) {
      case 'open':
        return trade.status === 'open';
      case 'closed':
        return trade.status === 'closed';
      case 'win':
        return trade.status === 'closed' && (trade.netPnL || 0) > 0;
      case 'loss':
        return trade.status === 'closed' && (trade.netPnL || 0) <= 0;
      default:
        return true;
    }
  }).slice(0, limit);

  const stats = {
    total: trades.length,
    open: trades.filter(t => t.status === 'open').length,
    closed: trades.filter(t => t.status === 'closed').length,
    wins: trades.filter(t => t.status === 'closed' && (t.netPnL || 0) > 0).length,
    losses: trades.filter(t => t.status === 'closed' && (t.netPnL || 0) <= 0).length,
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Trade History</h3>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
            Last {Math.min(limit, trades.length)} trades
          </span>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'all', label: 'All', count: stats.total },
              { key: 'open', label: 'Open', count: stats.open },
              { key: 'closed', label: 'Closed', count: stats.closed },
              { key: 'win', label: 'Wins', count: stats.wins },
              { key: 'loss', label: 'Losses', count: stats.losses },
            ] as { key: FilterStatus; label: string; count: number }[]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === key
                    ? 'bg-sigma/20 text-sigma border border-sigma/30'
                    : 'bg-card-hover text-gray-400 hover:text-white'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-card-hover/50">
            <tr className="text-xs text-gray-500 uppercase">
              <th className="text-left px-4 py-3 font-medium">Symbol</th>
              <th className="text-left px-4 py-3 font-medium">Signal</th>
              <th className="text-left px-4 py-3 font-medium">Entry</th>
              <th className="text-left px-4 py-3 font-medium">Exit</th>
              <th className="text-right px-4 py-3 font-medium">P&L</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredTrades.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No trades found. Start trading to see results here.
                </td>
              </tr>
            ) : (
              filteredTrades.map((trade) => (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  expanded={expandedId === trade.id}
                  onToggle={() => setExpandedId(expandedId === trade.id ? null : trade.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TradeRow({ trade, expanded, onToggle }: { trade: PaperTrade; expanded: boolean; onToggle: () => void }) {
  const isOpen = trade.status === 'open';
  const pnl = trade.netPnL || 0;
  const isWin = pnl > 0;
  const pnlPercent = trade.pnlPercent || 0;
  const isCash = (trade as any).segment === 'CASH';

  const formatTime = (timestamp: number) => {
    try {
      return format(new Date(timestamp), 'dd MMM HH:mm');
    } catch {
      return '-';
    }
  };

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const fmtP = (n: number) => n.toFixed(2);

  const getExitIcon = (reason?: string) => {
    switch (reason) {
      case 'target': return <Target size={14} className="text-active" />;
      case 'stoploss': return <Minus size={14} className="text-danger" />;
      case 'momentum_exhaustion': return <Clock size={14} className="text-warning" />;
      default: return null;
    }
  };

  return (
    <>
      <tr
        className="text-sm hover:bg-card-hover/50 transition-colors cursor-pointer select-none"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} className="text-gray-500 shrink-0" /> : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
            <span className="font-semibold text-white">{trade.symbol}</span>
            <span className="text-xs text-gray-500">
              {isCash ? `${(trade as any).shares ?? 1} sh` : `${trade.futuresLots} lot${trade.futuresLots !== 1 ? 's' : ''}`}
            </span>
          </div>
          {!isCash && trade.atmStrike > 0 && (
            <div className="text-xs text-gray-500 mt-0.5 pl-5">
              {trade.optionType} {trade.atmStrike} hedge
            </div>
          )}
          {isCash && (
            <div className="text-xs text-gray-500 mt-0.5 pl-5">Cash / Equity</div>
          )}
        </td>

        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
            trade.signal === 'BUY' ? 'bg-active/10 text-active' : 'bg-danger/10 text-danger'
          }`}>
            {trade.signal === 'BUY' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trade.signal}
          </span>
        </td>

        <td className="px-4 py-3">
          <div className="font-medium">₹{fmtP(trade.entryPrice)}</div>
          {trade.indicators && (
            <div className="text-xs text-gray-500 mt-0.5">RSI {Math.round(trade.indicators.rsi)}</div>
          )}
        </td>

        <td className="px-4 py-3">
          {trade.exitPrice ? (
            <div className="flex items-center gap-1.5">
              <span className="font-medium">₹{fmtP(trade.exitPrice)}</span>
              {getExitIcon(trade.exitReason)}
            </div>
          ) : (
            <span className="text-gray-500">—</span>
          )}
          {trade.exitReason && (
            <div className="text-xs text-gray-500 mt-0.5 capitalize">
              {trade.exitReason.replace(/_/g, ' ')}
            </div>
          )}
        </td>

        <td className="px-4 py-3 text-right">
          {isOpen ? (
            <span className="text-gray-500">—</span>
          ) : (
            <div className={`font-semibold ${isWin ? 'text-active' : 'text-danger'}`}>
              {isWin ? '+' : ''}₹{fmt(pnl)}
            </div>
          )}
          {!isOpen && pnlPercent !== 0 && (
            <div className={`text-xs ${isWin ? 'text-active/80' : 'text-danger/80'}`}>
              {isWin ? '+' : ''}{pnlPercent.toFixed(1)}%
            </div>
          )}
        </td>

        <td className="px-4 py-3 text-center">
          {isOpen ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-warning/10 text-warning text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
              Open
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 ${isWin ? 'text-active' : 'text-danger'}`}>
              {isWin ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </span>
          )}
        </td>

        <td className="px-4 py-3 text-xs text-gray-500">
          <div>{formatTime(trade.entryTime)}</div>
          {trade.exitTime && <div className="text-gray-600">→ {formatTime(trade.exitTime)}</div>}
          {trade.duration && <div className="text-gray-600 mt-0.5">{Math.round(trade.duration)} min</div>}
        </td>
      </tr>

      {/* ── Expanded detail drawer ── */}
      {expanded && (
        <tr className="bg-card-hover/30 border-b border-border">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">

              {/* Futures / Equity Leg */}
              <div className="bg-card rounded-lg p-3 space-y-1.5">
                <div className="text-gray-400 font-semibold uppercase tracking-wide mb-2">
                  {isCash ? 'Equity Leg' : 'Futures Leg'}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Direction</span>
                  <span className={trade.signal === 'BUY' ? 'text-active' : 'text-danger'}>
                    {trade.signal === 'BUY' ? 'Long' : 'Short'} {isCash ? 'Equity' : 'Futures'}
                  </span>
                </div>
                {isCash ? (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shares</span>
                    <span className="text-white">{(trade as any).shares ?? 1}</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Lots × Size</span>
                    <span className="text-white">{trade.futuresLots} × {trade.lotSize} = {trade.futuresLots * trade.lotSize} qty</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Entry price</span>
                  <span className="text-white">₹{fmtP(trade.entryPrice)}</span>
                </div>
                {trade.exitPrice && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Exit price</span>
                    <span className="text-white">₹{fmtP(trade.exitPrice)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                  <span className="text-gray-500">Futures P&L</span>
                  <span className={trade.grossPnL >= 0 ? 'text-active' : 'text-danger'}>
                    {trade.grossPnL >= 0 ? '+' : ''}₹{fmt(trade.grossPnL)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Margin used</span>
                  <span className="text-gray-300">₹{fmt(trade.marginUsed)}</span>
                </div>
              </div>

              {/* Options Hedge Leg (Futures only) */}
              {!isCash && trade.atmStrike > 0 ? (
                <div className="bg-card rounded-lg p-3 space-y-1.5">
                  <div className="text-gray-400 font-semibold uppercase tracking-wide mb-2">Options Hedge</div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Instrument</span>
                    <span className="text-white">{trade.symbol} {trade.atmStrike} {trade.optionType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Action</span>
                    <span className="text-yellow-400">Buy {trade.optionLots} lot{trade.optionLots !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Premium paid</span>
                    <span className="text-white">₹{fmtP(trade.optionEntryPrice)}/sh = ₹{fmt(trade.hedgeCost)}</span>
                  </div>
                  {trade.optionExitPrice != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Exit premium</span>
                      <span className="text-white">₹{fmtP(trade.optionExitPrice)}</span>
                    </div>
                  )}
                  {trade.optionExpiry && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Expiry</span>
                      <span className="text-gray-300">{trade.optionExpiry}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                    <span className="text-gray-500">Hedge P&L</span>
                    <span className={trade.hedgePnL >= 0 ? 'text-active' : 'text-danger'}>
                      {trade.hedgePnL >= 0 ? '+' : ''}₹{fmt(trade.hedgePnL)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Max loss capped at</span>
                    <span className="text-orange-400">₹{fmt(trade.maxLoss)}</span>
                  </div>
                </div>
              ) : !isCash ? (
                <div className="bg-card rounded-lg p-3 flex items-center justify-center text-gray-600 text-xs">
                  No hedge data
                </div>
              ) : (
                <div className="bg-card rounded-lg p-3 space-y-1.5">
                  <div className="text-gray-400 font-semibold uppercase tracking-wide mb-2">Risk</div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Max loss</span>
                    <span className="text-orange-400">₹{fmt(trade.maxLoss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Initial risk</span>
                    <span className="text-gray-300">₹{fmt(trade.initialRisk)}</span>
                  </div>
                </div>
              )}

              {/* Charges + Net P&L */}
              <div className="bg-card rounded-lg p-3 space-y-1.5">
                <div className="text-gray-400 font-semibold uppercase tracking-wide mb-2">Charges & Net P&L</div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Brokerage</span>
                  <span className="text-gray-300">₹{fmtP(trade.brokerage)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">STT</span>
                  <span className="text-gray-300">₹{fmtP(trade.stt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Txn charges</span>
                  <span className="text-gray-300">₹{fmtP(trade.transactionCharges)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GST</span>
                  <span className="text-gray-300">₹{fmtP(trade.gst)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                  <span className="text-gray-500">Total charges</span>
                  <span className="text-red-400">−₹{fmt(trade.totalCharges)}</span>
                </div>
                <div className="flex justify-between font-semibold text-sm border-t border-border pt-1.5 mt-1.5">
                  <span className="text-gray-400">Net P&L</span>
                  <span className={pnl >= 0 ? 'text-active' : 'text-danger'}>
                    {pnl >= 0 ? '+' : ''}₹{fmt(pnl)}
                    {pnlPercent !== 0 && <span className="text-xs font-normal ml-1">({pnlPercent.toFixed(1)}%)</span>}
                  </span>
                </div>
                {trade.indicators && (
                  <div className="border-t border-border pt-2 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">RSI at entry</span>
                      <span className="text-gray-300">{Math.round(trade.indicators.rsi)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Score</span>
                      <span className="text-gray-300">{trade.indicators.momentumScore}/100</span>
                    </div>
                    {trade.indicators.timeframeAlignment && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">TF alignment</span>
                        <span className="text-gray-300 capitalize">{trade.indicators.timeframeAlignment}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}
