"use client";

import { useEffect, useState } from "react";

/** GSS chart palette (docs/SPEC.md §5.1) */
export const PALETTE = ["#3c2fa3", "#0e8a7e", "#d17a22", "#2f6db5", "#b4436c", "#6b7a90", "#c9a227", "#7a5a3a"];
export const PALETTE_DARK = ["#8b7ff0", "#2fc4b2", "#f0a050", "#6aa7e8", "#e57aa0", "#9aa7bb", "#e8c454", "#c49a74"];
export const SEQ = ["#eeecfa", "#d6d2f2", "#a59be3", "#5040c9", "#3c2fa3", "#2c2270", "#1a1343"];
export const SEQ_DARK = ["#2a2648", "#3a3270", "#4c3acb", "#6b5ce0", "#8b7ff0", "#b3aaf5", "#dcd7fb"];

/** Fixed semantic colour assignments — same meaning on every page */
export const MODE_COLOR: Record<string, string> = { CATI: "#3c2fa3", CAPI: "#0e8a7e", Web: "#d17a22" };
export const DISP_COLOR: Record<string, string> = {
  Complete: "#3c2fa3", Partial: "#2f6db5", "Non-contact": "#6b7a90", Refused: "#b4436c", Pending: "#c9a227", "Not started": "#cbd1dd",
};
export const SEV_COLOR: Record<string, string> = { critical: "#b43c2a", major: "#d17a22", minor: "#c9a227", info: "#6b7a90" };
export const BAND_COLOR: Record<string, string> = { Good: "#0f7a55", Review: "#c9a227", Poor: "#d17a22", Reject: "#b43c2a" };

export interface ChartTheme {
  dark: boolean;
  text: string;
  muted: string;
  axis: string;
  grid: string;
  surface: string;
  palette: string[];
  seq: string[];
  primary: string;
  gold: string;
  good: string;
  bad: string;
  tooltip: Record<string, unknown>;
}

export function useChartTheme(): ChartTheme {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.theme === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dark
    ? {
        dark, text: "#ecebf7", muted: "#a3a0c2", axis: "#8f8bb0", grid: "#24203f", surface: "#16132b",
        palette: PALETTE_DARK, seq: SEQ_DARK, primary: "#8b7ff0", gold: "#f5c451", good: "#3ccf8e", bad: "#ff7a66",
        tooltip: { backgroundColor: "#1f1b3a", borderColor: "#3a3270", textStyle: { color: "#ecebf7", fontSize: 12 }, padding: [8, 12], extraCssText: "border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.4);" },
      }
    : {
        dark, text: "#0f172b", muted: "#4b5a70", axis: "#64748b", grid: "#e8ebf2", surface: "#ffffff",
        palette: PALETTE, seq: SEQ, primary: "#3c2fa3", gold: "#c9a227", good: "#0f7a55", bad: "#b43c2a",
        tooltip: { backgroundColor: "#ffffff", borderColor: "#e3e6ee", textStyle: { color: "#0f172b", fontSize: 12 }, padding: [8, 12], extraCssText: "border-radius:10px;box-shadow:0 12px 32px #0f172b29, 0 2px 6px #0f172b14;" },
      };
}

/** Map a light-mode series/semantic colour to its dark-mode counterpart (same hue, readable on dark surfaces). */
const DARK_SEMANTIC: Record<string, string> = { "#0f7a55": "#3ccf86", "#b43c2a": "#ff7a66", "#31268c": "#a59be3" };
export function accentFor(hex: string, dark: boolean): string {
  if (!dark) return hex;
  const h = hex.toLowerCase();
  const i = PALETTE.indexOf(h);
  return i >= 0 ? PALETTE_DARK[i] : DARK_SEMANTIC[h] ?? hex;
}

/** Common axis styling */
export function axisStyle(t: ChartTheme) {
  return {
    axisLine: { lineStyle: { color: t.grid } },
    axisTick: { show: false },
    axisLabel: { color: t.axis, fontSize: 12, fontFamily: "Inter, sans-serif" },
    splitLine: { lineStyle: { color: t.grid } },
  };
}

export function baseOption(t: ChartTheme) {
  return {
    textStyle: { fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", color: t.text },
    color: t.palette,
    animationDuration: 700,
    animationEasing: "cubicOut",
    tooltip: { ...t.tooltip, confine: true },
  };
}
