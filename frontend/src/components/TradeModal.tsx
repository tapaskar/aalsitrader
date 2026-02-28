import { useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { X, TrendingUp, TrendingDown, DollarSign, Target, StopCircle } from 'lucide-react';
import type { Trade } from '../types';

export function TradeModal() {
  const { trades, addTrade, agents } = useDashboardStore();
  const [isOpen, setIsOpen] = useState(false);
  const [newTrade, setNewTrade] = useState({
    symbol: '',
    direction: 'long' as 'long' | 'short',
    entryPrice: '',
    stopLoss: '',
    target: '',
    setupType: '',
    agentId: 'sigma',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTrade({
      symbol: newTrade.symbol,
      direction: newTrade.direction,
      entryPrice: parseFloat(newTrade.entryPrice),
      stopLoss: parseFloat(newTrade.stopLoss),
      target: parseFloat(newTrade.target),
      setupType: newTrade.setupType,
      agentId: newTrade.agentId,
      status: 'open',
      grade: 'B',
    });
    setNewTrade({
      symbol: '',
      direction: 'long',
      entryPrice: '',
      stopLoss: '',
      target: '',
      setupType: '',
      agentId: 'sigma',
    });
    setIsOpen(false);
  };

  // Calculate stats
  const openTrades = trades.filter((t) => t.status === 'open');
  const closedTrades = trades.filter((t) => t.status === 'closed');
  const winRate = closedTrades.length > 0
    ? Math.round((closedTrades.filter((t) => (t.pnl || 0) > 0).length / closedTrades.length) * 100)
    : 0;
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  return (
    <>
      {/* Trade Stats Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-sigma hover:bg-sigma/80 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105"
      >
        <DollarSign className="w-5 h-5" />
        <span className="font-semibold">
          {trades.length} Trades | {winRate}% Win | ₹{totalPnl.toFixed(0)}
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border max-w-2xl w-full max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Trade Management</h2>
                <p className="text-sm text-gray-500">
                  {openTrades.length} open • {closedTrades.length} closed • {winRate}% win rate
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-card-hover rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* New Trade Form */}
              <form onSubmit={handleSubmit} className="mb-6 p-4 bg-card-hover rounded-xl">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sigma" />
                  New Trade
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <input
                    type="text"
                    placeholder="Symbol"
                    value={newTrade.symbol}
                    onChange={(e) => setNewTrade({ ...newTrade, symbol: e.target.value.toUpperCase() })}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    required
                  />
                  <select
                    value={newTrade.direction}
                    onChange={(e) => setNewTrade({ ...newTrade, direction: e.target.value as 'long' | 'short' })}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Entry ₹"
                    value={newTrade.entryPrice}
                    onChange={(e) => setNewTrade({ ...newTrade, entryPrice: e.target.value })}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Setup Type"
                    value={newTrade.setupType}
                    onChange={(e) => setNewTrade({ ...newTrade, setupType: e.target.value })}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <StopCircle className="w-4 h-4 text-danger" />
                    <input
                      type="number"
                      placeholder="Stop Loss ₹"
                      value={newTrade.stopLoss}
                      onChange={(e) => setNewTrade({ ...newTrade, stopLoss: e.target.value })}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-active" />
                    <input
                      type="number"
                      placeholder="Target ₹"
                      value={newTrade.target}
                      onChange={(e) => setNewTrade({ ...newTrade, target: e.target.value })}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={newTrade.agentId}
                    onChange={(e) => setNewTrade({ ...newTrade, agentId: e.target.value })}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    {agents.filter((a) => ['sigma', 'alpha', 'beta'].includes(a.id)).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.greek} {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="flex-1 bg-sigma hover:bg-sigma/80 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Add Trade
                  </button>
                </div>
              </form>

              {/* Trade List */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">
                  Active Trades
                </h3>
                
                {trades.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">No trades yet</p>
                ) : (
                  trades.map((trade) => (
                    <div
                      key={trade.id}
                      className={`p-4 rounded-xl border ${
                        trade.status === 'open'
                          ? 'bg-card-hover border-border'
                          : trade.pnl && trade.pnl > 0
                          ? 'bg-active/10 border-active/30'
                          : 'bg-danger/10 border-danger/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{trade.symbol}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              trade.direction === 'long'
                                ? 'bg-active/20 text-active'
                                : 'bg-danger/20 text-danger'
                            }`}
                          >
                            {trade.direction.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">{trade.setupType}</span>
                        </div>
                        {trade.pnl !== undefined && (
                          <span
                            className={`font-bold ${
                              trade.pnl > 0 ? 'text-active' : 'text-danger'
                            }`}
                          >
                            {trade.pnl > 0 ? '+' : ''}₹{trade.pnl.toFixed(0)}
                            {trade.pnlPercent && ` (${trade.pnlPercent > 0 ? '+' : ''}${trade.pnlPercent.toFixed(1)}%)`}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 block text-xs">Entry</span>
                          <span>₹{trade.entryPrice}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-xs">Stop</span>
                          <span className="text-danger">₹{trade.stopLoss}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-xs">Target</span>
                          <span className="text-active">₹{trade.target}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-xs">R:R</span>
                          <span>
                            {((Math.abs(trade.target - trade.entryPrice) / Math.abs(trade.stopLoss - trade.entryPrice)) || 0).toFixed(1)}:1
                          </span>
                        </div>
                      </div>

                      {trade.status === 'open' && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => {/* Close with profit */}}
                            className="flex-1 py-1.5 bg-active/20 hover:bg-active/30 text-active rounded text-xs font-medium transition-colors"
                          >
                            Close +Profit
                          </button>
                          <button
                            onClick={() => {/* Close with loss */}}
                            className="flex-1 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger rounded text-xs font-medium transition-colors"
                          >
                            Close -Loss
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
