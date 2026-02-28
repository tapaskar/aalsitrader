import { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';

export interface CandleInput {
  date: string;   // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CandlestickChartProps {
  candles: CandleInput[];
  height?: number;
  support?: number;
  resistance?: number;
  sma20?: number;
}

export function CandlestickChart({
  candles,
  height = 350,
  support,
  resistance,
  sma20,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    // Create chart
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(55, 65, 81, 0.3)' },
        horzLines: { color: 'rgba(55, 65, 81, 0.3)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(107, 114, 128, 0.4)', width: 1, style: 3 },
        horzLine: { color: 'rgba(107, 114, 128, 0.4)', width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: 'rgba(55, 65, 81, 0.5)',
        scaleMargins: { top: 0.05, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'rgba(55, 65, 81, 0.5)',
        timeVisible: false,
      },
      width: containerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;

    // Candlestick series (v5 API)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const chartData: CandlestickData[] = candles.map((c) => ({
      time: c.date as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(chartData);

    // Price lines for support/resistance/SMA
    if (support != null && support > 0) {
      candleSeries.createPriceLine({
        price: support,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'S',
      });
    }
    if (resistance != null && resistance > 0) {
      candleSeries.createPriceLine({
        price: resistance,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'R',
      });
    }
    if (sma20 != null && sma20 > 0) {
      candleSeries.createPriceLine({
        price: sma20,
        color: '#3b82f6',
        lineWidth: 1,
        lineStyle: 1, // Dotted
        axisLabelVisible: true,
        title: 'SMA20',
      });
    }

    // Volume series
    if (candles.some((c) => c.volume != null && c.volume > 0)) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });

      volumeSeries.setData(
        candles.map((c) => ({
          time: c.date as Time,
          value: c.volume || 0,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        }))
      );
    }

    // Fit content
    chart.timeScale().fitContent();

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        chart.applyOptions({ width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, height, support, resistance, sma20]);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
