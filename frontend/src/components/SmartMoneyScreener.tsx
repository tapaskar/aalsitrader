import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Search, Loader2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Check, Minus, Zap, X } from 'lucide-react';
import type { SmartMoneyStock } from '../types';
import { CandlestickChart } from './CandlestickChart';
import type { CandleInput } from './CandlestickChart';

const API_URL = import.meta.env.VITE_API_URL || 'https://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod';

type SortKey = 'symbol' | 'price' | 'trendStrength' | 'confidence' | 'structure' | 'signal' | 'rsi' | 'momentum5d';
type SortDir = 'asc' | 'desc';
type SignalFilter = 'ALL' | 'BUY' | 'SELL' | 'NEUTRAL';
type StructureFilter = 'ALL' | 'BOS' | 'CHOCH' | 'RANGE';

const structureLabels: Record<SmartMoneyStock['structure'], string> = {
  BOS_BULLISH: 'BOS Bull',
  BOS_BEARISH: 'BOS Bear',
  CHOCH_BULLISH: 'CHoCH Bull',
  CHOCH_BEARISH: 'CHoCH Bear',
  RANGE: 'Range',
};

const structureColors: Record<SmartMoneyStock['structure'], string> = {
  BOS_BULLISH: 'bg-active/20 text-active',
  BOS_BEARISH: 'bg-danger/20 text-danger',
  CHOCH_BULLISH: 'bg-warning/20 text-warning',
  CHOCH_BEARISH: 'bg-orange-500/20 text-orange-400',
  RANGE: 'bg-gray-500/20 text-gray-400',
};

type CardFilter = 'bullish' | 'bearish' | 'strong' | null;

export function SmartMoneyScreener() {
  const [stocks, setStocks] = useState<SmartMoneyStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState(0);
  const [cached, setCached] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('ALL');
  const [structureFilter, setStructureFilter] = useState<StructureFilter>('ALL');
  const [cardFilter, setCardFilter] = useState<CardFilter>(null);
  const [sortKey, setSortKey] = useState<SortKey>('trendStrength');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedStock, setSelectedStock] = useState<SmartMoneyStock | null>(null);

  const fetchScreener = useCallback(async (force = false) => {
    setLoading(true);
    setError('');
    try {
      const url = force ? `${API_URL}/screener?force=1` : `${API_URL}/screener`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStocks(data.stocks || []);
      setFetchedAt(data.fetchedAt || Date.now());
      setCached(data.cached || false);
      setMarketOpen(data.marketOpen ?? false);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch screener data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScreener();
  }, [fetchScreener]);

  const handleCardClick = (card: CardFilter) => {
    if (cardFilter === card) {
      // Toggle off
      setCardFilter(null);
      setSignalFilter('ALL');
    } else {
      setCardFilter(card);
      // Sync the signal filter bar when clicking bullish/bearish cards
      if (card === 'bullish') setSignalFilter('BUY');
      else if (card === 'bearish') setSignalFilter('SELL');
      else setSignalFilter('ALL');
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filteredStocks = useMemo(() => {
    let result = stocks;

    if (search) {
      const q = search.toUpperCase();
      result = result.filter((s) => s.symbol.includes(q));
    }

    if (signalFilter !== 'ALL') {
      result = result.filter((s) => s.signal === signalFilter);
    }

    if (cardFilter === 'strong') {
      result = result.filter((s) => s.confidence >= 60);
    }

    if (structureFilter !== 'ALL') {
      if (structureFilter === 'BOS') {
        result = result.filter((s) => s.structure.startsWith('BOS'));
      } else if (structureFilter === 'CHOCH') {
        result = result.filter((s) => s.structure.startsWith('CHOCH'));
      } else {
        result = result.filter((s) => s.structure === 'RANGE');
      }
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return result;
  }, [stocks, search, signalFilter, cardFilter, structureFilter, sortKey, sortDir]);

  // Summary stats
  const bullishCount = stocks.filter((s) => s.signal === 'BUY').length;
  const bearishCount = stocks.filter((s) => s.signal === 'SELL').length;
  const strongSetups = stocks.filter((s) => s.confidence >= 60).length;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-gray-600" />;
    return sortDir === 'desc'
      ? <ArrowDown className="w-3 h-3 text-active" />
      : <ArrowUp className="w-3 h-3 text-active" />;
  };

  return (
    <div className="space-y-4" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Smart Money Screener</h2>
            <p className="text-xs text-gray-500">
              F&O Top 100 — BOS/CHoCH Structure Analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {fetchedAt > 0 && (
            <span className="text-xs text-gray-500">
              {cached ? 'Cached' : 'Fresh'} — {new Date(fetchedAt).toLocaleTimeString('en-IN')}
            </span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            marketOpen
              ? 'bg-active/20 text-active'
              : 'bg-gray-500/20 text-gray-400'
          }`}>
            {marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
          </span>
          <button
            onClick={() => fetchScreener(true)}
            disabled={loading || !marketOpen}
            title={!marketOpen ? 'Refresh disabled — market is closed' : 'Refresh screener data'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !marketOpen
                ? 'bg-card-hover/50 text-gray-600 cursor-not-allowed'
                : 'bg-card-hover hover:bg-border text-white disabled:opacity-50'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards — clickable to filter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          onClick={() => { setCardFilter(null); setSignalFilter('ALL'); }}
          className={`bg-card rounded-xl p-3 border cursor-pointer transition-all ${
            cardFilter === null ? 'border-border' : 'border-border/30 opacity-60 hover:opacity-80'
          }`}
        >
          <div className="text-xs text-gray-500 mb-1">Stocks Scanned</div>
          <div className="text-2xl font-bold text-white">{stocks.length}</div>
        </div>
        <div
          onClick={() => handleCardClick('bullish')}
          className={`bg-card rounded-xl p-3 border cursor-pointer transition-all ${
            cardFilter === 'bullish'
              ? 'border-active ring-1 ring-active/30 bg-active/5'
              : 'border-active/30 hover:border-active/60'
          }`}
        >
          <div className="text-xs text-gray-500 mb-1">Bullish (BUY)</div>
          <div className="text-2xl font-bold text-active">{bullishCount}</div>
        </div>
        <div
          onClick={() => handleCardClick('bearish')}
          className={`bg-card rounded-xl p-3 border cursor-pointer transition-all ${
            cardFilter === 'bearish'
              ? 'border-danger ring-1 ring-danger/30 bg-danger/5'
              : 'border-danger/30 hover:border-danger/60'
          }`}
        >
          <div className="text-xs text-gray-500 mb-1">Bearish (SELL)</div>
          <div className="text-2xl font-bold text-danger">{bearishCount}</div>
        </div>
        <div
          onClick={() => handleCardClick('strong')}
          className={`bg-card rounded-xl p-3 border cursor-pointer transition-all ${
            cardFilter === 'strong'
              ? 'border-warning ring-1 ring-warning/30 bg-warning/5'
              : 'border-warning/30 hover:border-warning/60'
          }`}
        >
          <div className="text-xs text-gray-500 mb-1">Strong Setups</div>
          <div className="text-2xl font-bold text-warning">{strongSetups}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-active/50"
          />
        </div>

        <div className="flex items-center bg-card rounded-lg border border-border p-0.5">
          {(['ALL', 'BUY', 'SELL', 'NEUTRAL'] as SignalFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setSignalFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                signalFilter === f
                  ? f === 'BUY' ? 'bg-active/20 text-active'
                    : f === 'SELL' ? 'bg-danger/20 text-danger'
                    : f === 'NEUTRAL' ? 'bg-gray-500/20 text-gray-300'
                    : 'bg-card-hover text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-card rounded-lg border border-border p-0.5">
          {(['ALL', 'BOS', 'CHOCH', 'RANGE'] as StructureFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStructureFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                structureFilter === f
                  ? 'bg-card-hover text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-500 ml-auto">
          {filteredStocks.length} of {stocks.length} stocks
        </span>
      </div>

      {/* Table */}
      {loading && stocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-sm">Scanning 100 F&O stocks...</p>
          <p className="text-xs mt-1">This may take a few seconds</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-danger">
          <AlertTriangle className="w-8 h-8 mb-3" />
          <p className="text-sm">{error}</p>
          <button
            onClick={() => fetchScreener()}
            className="mt-3 px-4 py-2 bg-card-hover rounded-lg text-xs text-white hover:bg-border transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="overflow-auto flex-1 bg-card rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border text-gray-500 text-xs">
                {([
                  ['symbol', 'Symbol'],
                  ['price', 'Price'],
                  ['trendStrength', 'Trend Str.'],
                  ['confidence', 'Confidence'],
                  ['structure', 'Structure'],
                  ['signal', 'Signal'],
                  ['rsi', 'RSI'],
                  ['momentum5d', '5d Mom'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-3 py-2.5 text-left font-medium cursor-pointer hover:text-gray-300 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      <SortIcon col={key} />
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left font-medium text-xs">Vol</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock) => (
                <tr
                  key={stock.symbol}
                  className="border-b border-border/50 hover:bg-card-hover/50 transition-colors"
                >
                  {/* Symbol — clickable to open chart */}
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setSelectedStock(stock)}
                      className="font-semibold text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                    >
                      {stock.symbol}
                    </button>
                  </td>

                  {/* Price */}
                  <td className="px-3 py-2.5 text-gray-300">
                    {stock.price.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </td>

                  {/* Trend Strength Bar */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden relative">
                        {stock.trendStrength >= 0 ? (
                          <div
                            className="absolute left-1/2 top-0 h-full bg-active rounded-full"
                            style={{ width: `${Math.abs(stock.trendStrength) / 2}%` }}
                          />
                        ) : (
                          <div
                            className="absolute right-1/2 top-0 h-full bg-danger rounded-full"
                            style={{ width: `${Math.abs(stock.trendStrength) / 2}%` }}
                          />
                        )}
                        <div className="absolute left-1/2 top-0 w-px h-full bg-gray-600" />
                      </div>
                      <span
                        className={`text-xs font-mono w-8 text-right ${
                          stock.trendStrength > 0 ? 'text-active' : stock.trendStrength < 0 ? 'text-danger' : 'text-gray-400'
                        }`}
                      >
                        {stock.trendStrength > 0 ? '+' : ''}{stock.trendStrength}
                      </span>
                    </div>
                  </td>

                  {/* Confidence */}
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-xs font-semibold ${
                        stock.confidence >= 60 ? 'text-active' : stock.confidence >= 40 ? 'text-warning' : 'text-gray-400'
                      }`}
                    >
                      {stock.confidence}%
                    </span>
                  </td>

                  {/* Structure */}
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${structureColors[stock.structure]}`}>
                      {structureLabels[stock.structure]}
                    </span>
                  </td>

                  {/* Signal */}
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        stock.signal === 'BUY'
                          ? 'bg-active/20 text-active'
                          : stock.signal === 'SELL'
                            ? 'bg-danger/20 text-danger'
                            : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {stock.signal}
                    </span>
                  </td>

                  {/* RSI */}
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-xs font-mono ${
                        stock.rsi > 70 ? 'text-danger' : stock.rsi < 30 ? 'text-active' : 'text-gray-300'
                      }`}
                    >
                      {stock.rsi.toFixed(1)}
                    </span>
                  </td>

                  {/* 5d Momentum */}
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-xs font-mono ${
                        stock.momentum5d > 0 ? 'text-active' : stock.momentum5d < 0 ? 'text-danger' : 'text-gray-400'
                      }`}
                    >
                      {stock.momentum5d > 0 ? '+' : ''}{stock.momentum5d.toFixed(1)}%
                    </span>
                  </td>

                  {/* Volume Surge */}
                  <td className="px-3 py-2.5 text-center">
                    {stock.volumeSurge ? (
                      <Check className="w-3.5 h-3.5 text-warning inline" />
                    ) : (
                      <Minus className="w-3.5 h-3.5 text-gray-700 inline" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStocks.length === 0 && !loading && (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
              No stocks match your filters
            </div>
          )}
        </div>
      )}
      {/* Chart Modal */}
      {selectedStock && (
        <StockChartModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}

/* ─── Stock Chart Modal ─── */

function StockChartModal({ stock, onClose }: { stock: SmartMoneyStock; onClose: () => void }) {
  const [candles, setCandles] = useState<CandleInput[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState('');

  useEffect(() => {
    setChartLoading(true);
    setChartError('');
    fetch(`${API_URL}/screener/chart?symbol=${encodeURIComponent(stock.symbol)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setCandles(data.candles || []);
      })
      .catch((err) => setChartError(err.message || 'Failed to load chart'))
      .finally(() => setChartLoading(false));
  }, [stock.symbol]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-3xl mx-4 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-white">{stock.symbol}</span>
            <span className="text-sm text-gray-400">
              {stock.price.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                stock.signal === 'BUY'
                  ? 'bg-active/20 text-active'
                  : stock.signal === 'SELL'
                    ? 'bg-danger/20 text-danger'
                    : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {stock.signal}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${structureColors[stock.structure]}`}>
              {structureLabels[stock.structure]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-card-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Chart Area */}
        <div style={{ height: '350px' }} className="px-2 pt-3">
          {chartLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading chart...
            </div>
          ) : chartError ? (
            <div className="flex items-center justify-center h-full text-danger text-sm">
              <AlertTriangle className="w-4 h-4 mr-2" />
              {chartError}
            </div>
          ) : (
            <CandlestickChart
              candles={candles}
              height={350}
              support={stock.support}
              resistance={stock.resistance}
              sma20={stock.sma20}
            />
          )}
        </div>

        {/* Technical Summary Bar */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-border">
          <div className="bg-card p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">Trend Str.</div>
            <div className={`text-sm font-bold ${stock.trendStrength > 0 ? 'text-active' : stock.trendStrength < 0 ? 'text-danger' : 'text-gray-400'}`}>
              {stock.trendStrength > 0 ? '+' : ''}{stock.trendStrength}
            </div>
          </div>
          <div className="bg-card p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">Confidence</div>
            <div className={`text-sm font-bold ${stock.confidence >= 60 ? 'text-active' : 'text-warning'}`}>
              {stock.confidence}%
            </div>
          </div>
          <div className="bg-card p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">RSI</div>
            <div className={`text-sm font-bold ${stock.rsi > 70 ? 'text-danger' : stock.rsi < 30 ? 'text-active' : 'text-white'}`}>
              {stock.rsi.toFixed(1)}
            </div>
          </div>
          <div className="bg-card p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">5d Mom</div>
            <div className={`text-sm font-bold ${stock.momentum5d > 0 ? 'text-active' : 'text-danger'}`}>
              {stock.momentum5d > 0 ? '+' : ''}{stock.momentum5d.toFixed(1)}%
            </div>
          </div>
          <div className="bg-card p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">Support</div>
            <div className="text-sm font-bold text-active">
              {stock.support.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-card p-3 text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">Resistance</div>
            <div className="text-sm font-bold text-danger">
              {stock.resistance.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
