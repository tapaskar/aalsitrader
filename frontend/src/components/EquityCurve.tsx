import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import type { EquityPoint } from '../types';

interface EquityCurveProps {
  data: EquityPoint[];
  startingCapital: number;
  height?: number;
  isLive?: boolean;
}

interface ChartPoint extends EquityPoint {
  formattedTime: string;
  formattedDate: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  label?: number;
}

export function EquityCurve({ data, startingCapital, height = 300, isLive = false }: EquityCurveProps) {
  const stats = useMemo(() => {
    if (data.length === 0) {
      return {
        currentCapital: startingCapital,
        peakCapital: startingCapital,
        totalReturn: 0,
        maxDrawdown: 0,
        startDate: null,
        endDate: null,
      };
    }

    const currentCapital = data[data.length - 1].capital;
    const peakCapital = Math.max(...data.map(d => d.capital), startingCapital);
    const totalReturn = ((currentCapital - startingCapital) / startingCapital) * 100;
    const maxDrawdown = Math.max(...data.map(d => d.drawdown), 0);

    return {
      currentCapital,
      peakCapital,
      totalReturn,
      maxDrawdown,
      startDate: data[0].timestamp,
      endDate: data[data.length - 1].timestamp,
    };
  }, [data, startingCapital]);

  const chartData = useMemo(() => {
    return data.map(point => ({
      ...point,
      formattedTime: format(new Date(point.timestamp), 'dd MMM'),
      formattedDate: format(new Date(point.timestamp), 'dd MMM yyyy HH:mm'),
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const pnl = point.capital - startingCapital;
      const isProfit = pnl >= 0;

      return (
        <div className="bg-card border border-border rounded-xl p-3 shadow-xl">
          <div className="text-xs text-gray-500 mb-1">{point.formattedDate}</div>
          <div className="text-lg font-bold text-white mb-1">
            ₹{point.capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className={`text-sm font-medium ${isProfit ? 'text-active' : 'text-danger'}`}>
            {isProfit ? '+' : ''}₹{pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            {' '}({isProfit ? '+' : ''}{((pnl / startingCapital) * 100).toFixed(1)}%)
          </div>
          {point.openPositions > 0 && (
            <div className="text-xs text-warning mt-1">
              {point.openPositions} open position{point.openPositions > 1 ? 's' : ''}
            </div>
          )}
          {point.drawdown > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Drawdown: {point.drawdown.toFixed(1)}%
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const isPositiveReturn = stats.totalReturn >= 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-sigma" />
            Equity Curve
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Trading performance over time
          </p>
        </div>
        
        <div className="text-right">
          <div className={`text-2xl font-bold ${isPositiveReturn ? 'text-active' : 'text-danger'}`}>
            {isPositiveReturn ? '+' : ''}{stats.totalReturn.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">
            ₹{stats.currentCapital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={isLive ? 'Broker Balance' : 'Starting Capital'}
          value={startingCapital > 0 ? `₹${startingCapital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
          icon={null}
        />
        <StatCard
          label="Peak Capital"
          value={`₹${stats.peakCapital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={<TrendingUp className="w-4 h-4 text-active" />}
          trend="up"
        />
        <StatCard
          label="Max Drawdown"
          value={`${stats.maxDrawdown.toFixed(1)}%`}
          icon={<TrendingDown className="w-4 h-4 text-danger" />}
          trend="down"
        />
        <StatCard
          label="Data Points"
          value={`${data.length}`}
          icon={null}
        />
      </div>

      {/* Chart */}
      <div className="h-[300px] md:h-[400px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No equity data yet. Start trading to see the curve.</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositiveReturn ? "#22c55e" : "#ef4444"} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={isPositiveReturn ? "#22c55e" : "#ef4444"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis 
                dataKey="formattedTime" 
                stroke="#666"
                tick={{ fill: '#666', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#333' }}
              />
              <YAxis 
                stroke="#666"
                tick={{ fill: '#666', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#333' }}
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine 
                y={startingCapital} 
                stroke="#666" 
                strokeDasharray="3 3"
                label={{ value: 'Start', fill: '#666', fontSize: 10, position: 'insideTopLeft' }}
              />
              <Area
                type="monotone"
                dataKey="capital"
                stroke={isPositiveReturn ? "#22c55e" : "#ef4444"}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCapital)"
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Date Range */}
      {stats.startDate && stats.endDate && (
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>{format(new Date(stats.startDate), 'dd MMM yyyy')}</span>
          <span>{format(new Date(stats.endDate), 'dd MMM yyyy')}</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon,
  trend,
}: { 
  label: string; 
  value: string; 
  icon: React.ReactNode;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="bg-card-hover rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        {icon}
      </div>
      <div className={`text-base font-semibold ${
        trend === 'up' ? 'text-active' : 
        trend === 'down' ? 'text-danger' : 
        'text-white'
      }`}>
        {value}
      </div>
    </div>
  );
}

// Simplified version for embedded use
export function EquityCurveCompact({ 
  data, 
  startingCapital 
}: { 
  data: EquityPoint[]; 
  startingCapital: number;
}) {
  const currentCapital = data.length > 0 ? data[data.length - 1].capital : startingCapital;
  const pnl = currentCapital - startingCapital;
  const isProfit = pnl >= 0;

  return (
    <div className="flex items-center gap-4">
      <div className={`text-2xl font-bold ${isProfit ? 'text-active' : 'text-danger'}`}>
        {isProfit ? '+' : ''}₹{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </div>
      <div className="text-xs text-gray-400">
        <div>₹{currentCapital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
        <div className={isProfit ? 'text-active' : 'text-danger'}>
          {isProfit ? '+' : ''}{((pnl / startingCapital) * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
