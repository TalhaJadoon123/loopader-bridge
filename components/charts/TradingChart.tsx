"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  ColorType,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";
import { cn } from "@/lib/utils";

interface TradingChartProps {
  symbol: string;
  interval?: string;
  height?: number;
  indicators?: string[];
  showVolume?: boolean;
  showLiveLine?: boolean;
}

export function TradingChart({
  symbol,
  interval = "5m",
  height = 420,
  indicators = [],
  showVolume = true,
  showLiveLine = true,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [hoverData, setHoverData] = useState<{ o: number; h: number; l: number; c: number; t: number } | null>(null);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b95a5",
        fontSize: 11,
        fontFamily: "var(--font-inter), sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(139,149,165,0.06)", style: LineStyle.Solid },
        horzLines: { color: "rgba(139,149,165,0.06)", style: LineStyle.Solid },
      },
      rightPriceScale: {
        borderColor: "rgba(139,149,165,0.15)",
        scaleMargins: { top: 0.1, bottom: showVolume ? 0.25 : 0.1 },
      },
      timeScale: {
        borderColor: "rgba(139,149,165,0.15)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 8,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(139,149,165,0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1c2537",
        },
        horzLine: {
          color: "rgba(139,149,165,0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1c2537",
        },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#0ecb81",
      downColor: "#f6465d",
      borderUpColor: "#0ecb81",
      borderDownColor: "#f6465d",
      wickUpColor: "#0ecb81",
      wickDownColor: "#f6465d",
      priceLineColor: "#f59e0b",
      priceLineStyle: LineStyle.Dotted,
      priceFormat: { type: "price", precision: 5, minMove: 0.00001 },
    });

    let volumeSeries: ISeriesApi<"Histogram"> | null = null;
    if (showVolume) {
      volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
        visible: false,
      });
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries!;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setHoverData(null);
        return;
      }
      const data = param.seriesData.get(candleSeries) as any;
      if (data) {
        setHoverData({ o: data.open, h: data.high, l: data.low, c: data.close, t: param.time as number });
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRef.current.clear();
    };
  }, [height, showVolume]);

  // Fetch candles + indicators
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/candles?symbol=${symbol}&interval=${interval}`);
      const data = await res.json();
      if (!data.candles?.length) return;

      const formatted = data.candles.map((c: any) => ({
        time: Math.floor(c.timestamp / 1000) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      candleSeriesRef.current?.setData(formatted);
      setLastPrice(formatted[formatted.length - 1]?.close ?? null);

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(
          data.candles.map((c: any) => ({
            time: Math.floor(c.timestamp / 1000) as Time,
            value: c.volume ?? 0,
            color: c.close >= c.open ? "rgba(14,203,129,0.35)" : "rgba(246,70,93,0.35)",
          }))
        );
      }

      // Apply indicators
      if (indicators.length) {
        const res2 = await fetch(`/api/market/candles?symbol=${symbol}&interval=${interval}`);
        void res2;
      }
      indicatorSeriesRef.current.forEach((s) => {
        try { chartRef.current?.removeSeries(s); } catch {}
      });
      indicatorSeriesRef.current.clear();

      for (const ind of indicators) {
        const resI = await fetch(`/api/indicators?symbol=${symbol}&interval=${interval}&type=${ind}`).catch(() => null);
        if (!resI?.ok) continue;
        const dataI = await resI.json();
        for (const line of dataI.indicators ?? []) {
          const series = chartRef.current!.addLineSeries({
            color: line.color,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: line.name,
          });
          series.setData(line.series.map((p: any) => ({ time: Math.floor(p.time / 1000) as Time, value: p.value })));
          indicatorSeriesRef.current.set(line.name, series);
        }
      }

      chartRef.current?.timeScale().scrollToRealTime();
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [symbol, interval, indicators.join(",")]);

  // Live price updates via quotes API
  useEffect(() => {
    fetchData();

    const priceUpdate = setInterval(async () => {
      try {
        const res = await fetch(`/api/market/quotes?symbols=${symbol}`);
        const data = await res.json();
        const quote = data.quotes?.[0];
        if (quote && quote.price > 0) {
          setPrevPrice(lastPrice);
          setLastPrice(quote.price);
          candleSeriesRef.current?.update({
            time: Math.floor(Date.now() / 1000) as Time,
            open: quote.price,
            high: quote.price,
            low: quote.price,
            close: quote.price,
          });
        }
      } catch {}
    }, 5000);

    const candleRefresh = setInterval(fetchData, 60000);

    return () => {
      clearInterval(priceUpdate);
      clearInterval(candleRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  const priceUp = lastPrice !== null && prevPrice !== null && lastPrice >= prevPrice;
  const changePct =
    lastPrice !== null && hoverData ? ((lastPrice - hoverData.o) / hoverData.o) * 100 : null;

  return (
    <div className="relative">
      {/* OHLC hover legend + live price ticker */}
      <div className="absolute top-2 left-3 z-10 flex flex-wrap items-center gap-3 text-xs font-mono pointer-events-none">
        <span className="font-semibold text-foreground text-sm tracking-wide">{symbol}</span>
        {hoverData ? (
          <span className="text-muted-foreground">
            O <span className="text-foreground">{hoverData.o.toFixed(5)}</span>
            H <span className="text-foreground">{hoverData.h.toFixed(5)}</span>
            L <span className="text-foreground">{hoverData.l.toFixed(5)}</span>
            C <span className={cn(priceUp ? "text-up" : "text-down")}>{hoverData.c.toFixed(5)}</span>
          </span>
        ) : lastPrice !== null ? (
          <span className={cn("font-semibold px-1.5 py-0.5 rounded", priceUp ? "text-up bg-up/10" : "text-down bg-down/10")}>
            {lastPrice.toFixed(5)}
          </span>
        ) : null}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm z-10 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Loading {symbol} chart…
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full transition-opacity duration-300"
        style={{ height, opacity: loading ? 0.3 : 1 }}
      />
    </div>
  );
}