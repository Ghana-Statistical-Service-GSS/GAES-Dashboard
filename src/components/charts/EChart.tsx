"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart, LineChart, PieChart, ScatterChart, GaugeChart, HeatmapChart, MapChart,
  BoxplotChart, FunnelChart, SankeyChart, TreemapChart, EffectScatterChart, CustomChart,
} from "echarts/charts";
import {
  GridComponent, TooltipComponent, LegendComponent, TitleComponent, DatasetComponent,
  VisualMapComponent, MarkLineComponent, MarkAreaComponent, MarkPointComponent,
  GeoComponent, DataZoomComponent, PolarComponent, GraphicComponent, AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption, ECharts } from "echarts/core";

echarts.use([
  BarChart, LineChart, PieChart, ScatterChart, GaugeChart, HeatmapChart, MapChart, BoxplotChart,
  FunnelChart, SankeyChart, TreemapChart, EffectScatterChart, CustomChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent, DatasetComponent, VisualMapComponent,
  MarkLineComponent, MarkAreaComponent, MarkPointComponent, GeoComponent, DataZoomComponent, PolarComponent,
  GraphicComponent, AriaComponent, CanvasRenderer,
]);

export { echarts };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOption = EChartsCoreOption | Record<string, any>;

export interface EChartProps {
  option: AnyOption;
  height?: number | string;
  className?: string;
  onClick?: (params: unknown) => void;
  /** pass a changing key to fully reset the chart instead of merging */
  notMerge?: boolean;
  ariaLabel?: string;
}

export default function EChart({ option, height = 300, className, onClick, notMerge = true, ariaLabel }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chart.current = c;
    c.on("click", (p) => clickRef.current?.(p));
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chart.current?.setOption((reduce ? { ...option, animation: false } : option) as EChartsCoreOption, { notMerge, lazyUpdate: true });
  }, [option, notMerge]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ width: "100%", height }}
    />
  );
}
