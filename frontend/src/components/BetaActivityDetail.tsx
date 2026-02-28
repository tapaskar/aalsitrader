import { useState, useEffect } from 'react';
import { Activity as ActivityIcon, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import type { Activity, BetaTechMetadata } from '../types';
import { CandlestickChart } from './CandlestickChart';
import type { CandleInput } from './CandlestickChart';

const API_URL = import.meta.env.VITE_API_URL || 'https://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod';

interface BetaActivityDetailProps {
  activity: Activity;
  metadata: BetaTechMetadata;
}

export function BetaActivityDetail({ activity, metadata }: BetaActivityDetailProps) {
  const { symbol, fullAnalysis, techData } = metadata;
  const [candles, setCandles] = useState<CandleInput[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    setChartLoading(true);
    fetch(`${API_URL}/screener/chart?symbol=${encodeURIComponent(symbol)}`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => setCandles(data.candles || []))
      .catch(() => {})
      .finally(() => setChartLoading(false));
  }, [symbol]);

  return (
    <div className="space-y-4">
      {/* Stock header with price */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">{symbol}</span>
          {techData?.overallSignal && (
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                techData.overallSignal === 'BUY'
                  ? 'bg-active/20 text-active'
                  : techData.overallSignal === 'SELL'
                    ? 'bg-danger/20 text-danger'
                    : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {techData.overallSignal}
            </span>
          )}
        </div>
        {techData?.currentPrice != null && (
          <div className="text-right">
            <div className="text-lg font-bold text-white">
              ₹{techData.currentPrice.toLocaleString('en-IN')}
            </div>
            {techData.changePercent != null && (
              <div
                className={`text-xs font-medium ${
                  techData.changePercent >= 0 ? 'text-active' : 'text-danger'
                }`}
              >
                {techData.changePercent >= 0 ? '+' : ''}
                {techData.changePercent}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* Candlestick Chart */}
      <div
        className="rounded-xl overflow-hidden border border-border"
        style={{ height: '280px' }}
      >
        {chartLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading chart...
          </div>
        ) : candles.length > 0 ? (
          <CandlestickChart
            candles={candles}
            height={280}
            support={techData?.supportResistance?.support}
            resistance={techData?.supportResistance?.resistance}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Chart data unavailable
          </div>
        )}
      </div>

      {/* Technical Indicators Grid */}
      {techData && (techData.rsi || techData.macd || techData.trend) && (
        <div className="grid grid-cols-3 gap-2">
          {/* RSI */}
          <div className="bg-card-hover rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-gray-500 mb-1">RSI</div>
            <div
              className={`text-lg font-bold ${
                (techData.rsi?.value ?? 50) > 70
                  ? 'text-danger'
                  : (techData.rsi?.value ?? 50) < 30
                    ? 'text-active'
                    : 'text-white'
              }`}
            >
              {techData.rsi?.value != null
                ? Number(techData.rsi.value).toFixed(1)
                : '--'}
            </div>
            <div className="text-[9px] text-gray-500">
              {techData.rsi?.signal ?? ''}
            </div>
          </div>

          {/* MACD */}
          <div className="bg-card-hover rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-gray-500 mb-1">MACD</div>
            <div className="text-sm font-bold text-white">
              {techData.macd?.histogram != null
                ? (techData.macd.histogram > 0 ? '+' : '') +
                  Number(techData.macd.histogram).toFixed(2)
                : '--'}
            </div>
            <div className="text-[9px] text-gray-500">
              {techData.macd?.signalInterpretation ?? ''}
            </div>
          </div>

          {/* Trend */}
          <div className="bg-card-hover rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-gray-500 mb-1">Trend</div>
            <div className="flex items-center justify-center gap-1">
              {techData.trend?.trend?.toUpperCase().includes('BULL') ? (
                <TrendingUp className="w-3.5 h-3.5 text-active" />
              ) : techData.trend?.trend?.toUpperCase().includes('BEAR') ? (
                <TrendingDown className="w-3.5 h-3.5 text-danger" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span
                className={`text-sm font-bold ${
                  techData.trend?.trend?.toUpperCase().includes('BULL')
                    ? 'text-active'
                    : techData.trend?.trend?.toUpperCase().includes('BEAR')
                      ? 'text-danger'
                      : 'text-gray-400'
                }`}
              >
                {techData.trend?.trend ?? '--'}
              </span>
            </div>
            <div className="text-[9px] text-gray-500">
              {techData.trend?.strength ?? ''}
            </div>
          </div>

          {/* Support */}
          <div className="bg-card-hover rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-gray-500 mb-1">Support</div>
            <div className="text-sm font-bold text-active">
              {techData.supportResistance?.support != null
                ? `₹${Number(techData.supportResistance.support).toLocaleString('en-IN')}`
                : '--'}
            </div>
          </div>

          {/* Resistance */}
          <div className="bg-card-hover rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-gray-500 mb-1">Resistance</div>
            <div className="text-sm font-bold text-danger">
              {techData.supportResistance?.resistance != null
                ? `₹${Number(techData.supportResistance.resistance).toLocaleString('en-IN')}`
                : '--'}
            </div>
          </div>

          {/* Overall Signal */}
          <div
            className={`rounded-lg p-2.5 text-center border ${
              techData.overallSignal === 'BUY'
                ? 'border-active/40 bg-active/10'
                : techData.overallSignal === 'SELL'
                  ? 'border-danger/40 bg-danger/10'
                  : 'border-border bg-card-hover'
            }`}
          >
            <div className="text-[10px] text-gray-500 mb-1">Signal</div>
            <div
              className={`text-sm font-bold ${
                techData.overallSignal === 'BUY'
                  ? 'text-active'
                  : techData.overallSignal === 'SELL'
                    ? 'text-danger'
                    : 'text-gray-400'
              }`}
            >
              {techData.overallSignal ?? 'NEUTRAL'}
            </div>
          </div>
        </div>
      )}

      {/* Bollinger + Volume badges */}
      {(techData?.bollingerPosition || techData?.volumeSurge) && (
        <div className="flex flex-wrap gap-1.5">
          {techData?.bollingerPosition && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-card-hover text-gray-400">
              Bollinger: {String(techData.bollingerPosition)}
            </span>
          )}
          {techData?.volumeSurge && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/20 text-warning">
              Volume Surge
            </span>
          )}
        </div>
      )}

      {/* Activity content (cleaned summary) */}
      <div className="text-sm text-gray-300 leading-relaxed">
        {activity.content}
      </div>

      {/* Full Analysis */}
      {fullAnalysis && (
        <div className="bg-card-hover rounded-xl p-3 border border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <ActivityIcon
              className="w-3.5 h-3.5"
              style={{ color: '#4ecdc4' }}
            />
            <span
              className="text-xs font-semibold"
              style={{ color: '#4ecdc4' }}
            >
              Full Analysis
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {fullAnalysis}
          </p>
        </div>
      )}
    </div>
  );
}
