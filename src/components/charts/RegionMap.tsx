"use client";

import { useEffect, useMemo, useState } from "react";
import EChart, { echarts } from "./EChart";
import { useChartTheme } from "@/components/ui/theme";
import { titleCase } from "@/lib/fmt";

let loaded: Promise<void> | null = null;
function loadGhana() {
  if (!loaded) {
    loaded = fetch("/geo/ghana-regions.json")
      .then((r) => r.json())
      .then((geo) => {
        echarts.registerMap("ghana", geo);
      });
  }
  return loaded;
}

export const ALL_REGIONS = [
  "WESTERN", "CENTRAL", "GREATER ACCRA", "VOLTA", "EASTERN", "ASHANTI", "WESTERN NORTH", "AHAFO",
  "BONO", "BONO EAST", "OTI", "NORTHERN", "SAVANNAH", "NORTH EAST", "UPPER EAST", "UPPER WEST",
];

export default function RegionMap({
  values, label, format = (v: number) => v.toLocaleString("en-GB"), onSelect, selected, height = 420, extra,
}: {
  values: Record<string, number>;
  label: string;
  format?: (v: number) => string;
  onSelect?: (region: string) => void;
  selected?: string;
  height?: number;
  extra?: (region: string) => string;
}) {
  const t = useChartTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadGhana().then(() => setReady(true));
  }, []);

  const option = useMemo(() => {
    if (!ready) return {};
    const vals = Object.values(values);
    const max = Math.max(1, ...vals);
    return {
      tooltip: {
        ...t.tooltip,
        trigger: "item",
        formatter: (p: { name: string; value: number }) => {
          const v = values[p.name];
          return `<div style="font-weight:700;margin-bottom:2px">${titleCase(p.name)}</div>${label}: <b>${v !== undefined ? format(v) : "no data"}</b>${extra ? `<br/>${extra(p.name)}` : ""}`;
        },
      },
      visualMap: {
        min: 0, max, left: 8, bottom: 8, calculable: false, itemWidth: 10, itemHeight: 90,
        text: [format(max), "0"], textStyle: { color: t.muted, fontSize: 11 },
        inRange: { color: t.seq.slice(0, 6) },
        seriesIndex: 0,
      },
      series: [
        {
          type: "map", map: "ghana", roam: false, nameProperty: "name", layoutCenter: ["52%", "50%"], layoutSize: "98%",
          aspectScale: 0.95,
          selectedMode: false,
          data: ALL_REGIONS.map((r) => ({
            name: r, value: values[r] ?? 0,
            itemStyle: values[r] === undefined ? { areaColor: t.dark ? "#24203f" : "#e3e6ee" } : r === selected ? { borderColor: t.gold, borderWidth: 2.5 } : undefined,
          })),
          itemStyle: { borderColor: t.dark ? "#16132b" : "#ffffff", borderWidth: 1.2 },
          emphasis: { label: { show: true, color: t.dark ? "#fff" : "#1a1343", fontWeight: 700, fontSize: 11 }, itemStyle: { areaColor: t.gold, shadowBlur: 12, shadowColor: "rgba(0,0,0,.25)" } },
          label: { show: false },
        },
      ],
    };
  }, [ready, values, t, label, format, selected, extra]);

  if (!ready) return <div className="skeleton" style={{ height }} />;
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`Map of Ghana's 16 regions shaded by ${label}`}
      onClick={(p) => {
        const name = (p as { name?: string }).name;
        if (name && onSelect) onSelect(name);
      }}
    />
  );
}
