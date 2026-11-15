/**
 * All survey constants and quality-check thresholds in ONE place (spec §3.1: "All thresholds live in one config object").
 * Values marked [assumption] come from docs/SPEC.md §6 and should be confirmed by HQ.
 */

export const SURVEY = {
  title: "Ghana Annual Economic Survey 2026",
  short: "GAES 2026",
  blurb:
    "Ghana's first annual survey of about 10,000 business establishments, collected mainly by telephone (CATI) from November to December 2026, covering fiscal year 2025.",
  fieldStart: "2026-11-13",
  /** 33 days of fieldwork, weekends included: 13 Nov – 15 Dec 2026 (confirmed by survey management) */
  fieldEnd: "2026-12-15",
  /** dates on which no fieldwork is planned (none — every day of the 33 counts) */
  holidays: [] as string[],
  /** weekends are fieldwork days */
  weekendsAreWorkdays: true,
  /** fallback national target if assignment actions are unavailable */
  nationalTargetFallback: 9994,
  interviewersTotal: 74,
  reviewUrl: (server: string, workspace: string, id: string) => `${server}/${workspace}/Interview/Review/${id}`,
};

export const T = {
  // Timing (minutes) — DQ-TM
  tooShortCritical: 10,
  tooShortMajor: 15,
  tooLongCati: 120,
  tooLongCapi: 150,
  webTooShort: 8,
  medGapSecMin: 3,
  pctFastMax: 0.2,
  finMedGapSecMin: 3,
  callHourStart: 7,
  callHourEnd: 19,
  nightStart: 22,
  nightEnd: 6,
  elapsedVsActiveAbs: 15,
  elapsedVsActiveRel: 0.5,
  afterEndAnswers: 10,
  overlapMin: 5,
  overlapMinAnswers: 10,
  rapidGapMin: 2,
  rapidWindowMin: 60,
  rapidWindowCount: 3,
  idleCapSec: 300,
  // Completeness
  zeroShareMajor: 0.9,
  // Economics
  /** [assumption] GHS 19.97/day × 27 days × 12 months */
  minWageAnnual: 6470,
  wpwHigh: 300000,
  lossMajorRatio: 3,
  lossMinorRatio: 1.5,
  lowCostShare: 0.05,
  lowCostMinRev: 12000,
  revTooSmall: 1200,
  itemVsRevRatio: 100,
  assetsVsRevRatio: 1000,
  hugeValue: 1e9,
  bigEmp: 500,
  soleBigEmp: 50,
  // Outliers (robust modified z on log10)
  outlierMinGroup: 20,
  outlierMinor: 3.5,
  outlierMajor: 5,
  // GPS
  gpsNearM: 40,
  gpsMidM: 500,
  gpsFarM: 5000,
  gpsAccMinor: 5,
  gpsAccMajor: 20,
  gpsTimeMin: 30,
  regionBboxPad: 0.1,
  // Mode / process
  nonContactMinAttempts: 6,
  burstCount: 5,
  burstWindowMin: 15,
  lateSubmitH: 24,
  waitSupH: 48,
  returnedH: 48,
  supOpenMinMin: 2,
  repeatRejections: 2,
  // Interviewer behaviour
  ibMinN: 5,
  ibShortRatio: 0.6,
  ibHeapMinValues: 30,
  ibHeapShare: 0.8,
  ibCriticalShare: 0.2,
  ibRejectRate: 0.3,
  ibZeroExcess: 0.15,
  ibZeroCpShare: 0.2,
  ibLowYieldAttempts: 10,
  ibIdenticalPositions: 40,
  ibIdenticalMaxZero: 0.8,
  ibInactiveWorkdays: 2,
  // Statistical outputs
  suppressBelow: 5,
};

/** Team roster from the questionnaire's cascading categories (spec §1.2) */
const ROSTER: Record<number, number[]> = {
  1: range(31, 45),
  2: [27, 28, 29, 30, ...range(46, 55)],
  3: range(6, 20),
  4: [23, 24, 25, 26, 62, 63, ...range(71, 79)],
  5: [21, 22, ...range(56, 61), ...range(64, 70)],
};
function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
export const TEAM_OF: Record<number, number> = Object.fromEntries(
  Object.entries(ROSTER).flatMap(([team, ids]) => ids.map((id) => [id, Number(team)]))
);
export const SUPERVISOR_OF_TEAM = (t: number) => `GAES${String(t).padStart(2, "0")}`;
export const loginOf = (code: number | null) => (code === null ? null : `GAES${String(code).padStart(2, "0")}`);

export const REGIONS: Record<number, string> = {
  1: "WESTERN", 2: "CENTRAL", 3: "GREATER ACCRA", 4: "VOLTA", 5: "EASTERN", 6: "ASHANTI", 7: "WESTERN NORTH", 8: "AHAFO",
  9: "BONO", 10: "BONO EAST", 11: "OTI", 12: "NORTHERN", 13: "SAVANNAH", 14: "NORTH EAST", 15: "UPPER EAST", 16: "UPPER WEST",
};

/** lat min, lat max, lon min, lon max (geoBoundaries ADM1) */
export const REGION_BBOX: Record<number, [number, number, number, number]> = {
  1: [4.739, 6.135, -3.111, -1.439], 2: [5.032, 6.299, -2.179, -0.388], 3: [5.482, 6.035, -0.499, 0.672],
  4: [5.771, 7.305, 0.059, 1.2], 5: [5.725, 7.196, -1.247, 0.295], 6: [5.855, 7.621, -2.448, -0.2],
  7: [5.341, 7.016, -3.261, -2.077], 8: [6.387, 7.342, -2.868, -1.851], 9: [6.836, 8.787, -3.11, -1.894],
  10: [7.172, 8.775, -2.122, 0.215], 11: [7.089, 8.775, -0.391, 0.731], 12: [8.232, 10.322, -1.368, 0.567],
  13: [7.993, 10.082, -2.78, -0.142], 14: [9.931, 10.714, -1.638, 0.418], 15: [10.274, 11.175, -1.573, 0.034],
  16: [9.636, 11.021, -2.941, -1.424],
};
export const GHANA_BBOX: [number, number, number, number] = [4.5, 11.5, -3.5, 1.5];

/** ISIC Rev.5 sections by division (spec §2.7) */
export const ISIC_SECTIONS: { letter: string; name: string; short: string; from: number; to: number }[] = [
  { letter: "A", name: "Agriculture, forestry and fishing", short: "Agriculture", from: 1, to: 3 },
  { letter: "B", name: "Mining and quarrying", short: "Mining", from: 5, to: 9 },
  { letter: "C", name: "Manufacturing", short: "Manufacturing", from: 10, to: 33 },
  { letter: "D", name: "Electricity, gas, steam and air conditioning", short: "Electricity & gas", from: 35, to: 35 },
  { letter: "E", name: "Water supply, sewerage, waste", short: "Water & waste", from: 36, to: 39 },
  { letter: "F", name: "Construction", short: "Construction", from: 41, to: 43 },
  { letter: "G", name: "Wholesale and retail trade", short: "Trade", from: 45, to: 47 },
  { letter: "H", name: "Transportation and storage", short: "Transport", from: 49, to: 53 },
  { letter: "I", name: "Accommodation and food service", short: "Accommodation & food", from: 55, to: 56 },
  { letter: "J", name: "Publishing, broadcasting, content", short: "Publishing & media", from: 58, to: 60 },
  { letter: "K", name: "Telecommunications, computer programming, information services", short: "ICT", from: 61, to: 63 },
  { letter: "L", name: "Financial and insurance", short: "Finance & insurance", from: 64, to: 66 },
  { letter: "M", name: "Real estate", short: "Real estate", from: 68, to: 68 },
  { letter: "N", name: "Professional, scientific and technical", short: "Professional services", from: 69, to: 75 },
  { letter: "O", name: "Administrative and support services", short: "Admin & support", from: 77, to: 82 },
  { letter: "P", name: "Public administration and defence", short: "Public admin", from: 84, to: 84 },
  { letter: "Q", name: "Education", short: "Education", from: 85, to: 85 },
  { letter: "R", name: "Human health and social work", short: "Health & social", from: 86, to: 88 },
  { letter: "S", name: "Arts, sports and recreation", short: "Arts & recreation", from: 90, to: 93 },
  { letter: "T", name: "Other service activities", short: "Other services", from: 94, to: 96 },
  { letter: "U", name: "Households as employers", short: "Households", from: 97, to: 98 },
  { letter: "V", name: "Extraterritorial organisations", short: "Extraterritorial", from: 99, to: 99 },
];
export function sectionOfDivision(div: number | null): string | null {
  if (div === null) return null;
  return ISIC_SECTIONS.find((s) => div >= s.from && div <= s.to)?.letter ?? null;
}

export const SIZE_CLASSES = ["No workers", "Micro (1-5)", "Small (6-30)", "Medium (31-100)", "Large (101+)"];
export function sizeClassOf(emp: number | null): string | null {
  if (emp === null) return null;
  if (emp <= 0) return SIZE_CLASSES[0];
  if (emp <= 5) return SIZE_CLASSES[1];
  if (emp <= 30) return SIZE_CLASSES[2];
  if (emp <= 100) return SIZE_CLASSES[3];
  return SIZE_CLASSES[4];
}

export const MODE_LABEL: Record<number, string> = { 1: "CATI", 2: "CAPI", 3: "Web" };
export const MODE_LONG: Record<number, string> = { 1: "CATI · telephone", 2: "CAPI · face-to-face", 3: "Web self-interview" };

export const DISP_LABEL: Record<string, string> = {
  COMPLETE: "Complete", PARTIAL: "Partial", NO_ANSWER: "No answer", UNREACHABLE: "Unreachable / wrong number",
  SWITCHED_OFF: "Phone switched off", CALL_DROPPED: "Call dropped", LANGUAGE: "Language barrier", CALLBACK: "Call-back requested",
  REFUSED: "Refused", NOT_STARTED: "Not started",
};
export const DISP_GROUP: Record<string, string> = {
  COMPLETE: "Complete", PARTIAL: "Partial", NO_ANSWER: "Non-contact", UNREACHABLE: "Non-contact", SWITCHED_OFF: "Non-contact",
  CALL_DROPPED: "Non-contact", LANGUAGE: "Pending", CALLBACK: "Pending", REFUSED: "Refused", NOT_STARTED: "Not started",
};

/** Pipeline stage from interview__status (spec §2.8) */
export const STAGES = [
  { key: "progress", label: "In progress", statuses: [0, 20, 40, 60, 80, 85, 95] },
  { key: "sup", label: "Awaiting supervisor", statuses: [100] },
  { key: "ret_sup", label: "Returned by supervisor", statuses: [65] },
  { key: "hq", label: "Awaiting HQ", statuses: [120] },
  { key: "ret_hq", label: "Returned by HQ", statuses: [125] },
  { key: "approved", label: "Approved by HQ", statuses: [130] },
];
export function stageOf(status: number | null): string {
  return STAGES.find((s) => s.statuses.includes(status ?? -99))?.key ?? "progress";
}
export const STATUS_LABEL: Record<number, string> = {
  [-1]: "Deleted", 0: "Restored", 20: "Created", 40: "Supervisor assigned", 60: "Interviewer assigned", 65: "Rejected by supervisor",
  80: "Ready for interview", 85: "Sent to CAPI", 95: "Restarted", 100: "Completed", 120: "Approved by supervisor",
  125: "Rejected by HQ", 130: "Approved by HQ",
};

/** Quality score weights & caps (spec §3.14) */
export const SCORE_W = { critical: 25, major: 8, minor: 2, info: 0 } as const;
export const SCORE_CAP: Record<string, number> = {
  Identification: 50, Duplication: 50, Completeness: 30, Timing: 30, Arithmetic: 50, Consistency: 30,
  "Range-Outlier": 16, GPS: 30, "Mode-specific": 16, Process: 10,
};
export function bandOf(score: number | null, hasCritical: boolean): string | null {
  if (score === null) return null;
  if (hasCritical || score < 50) return "Reject";
  if (score >= 85) return "Good";
  if (score >= 70) return "Review";
  return "Poor";
}

/** Working days between two ISO dates inclusive */
export function isWorkday(iso: string): boolean {
  const d = new Date(iso + "T12:00:00Z");
  const wd = d.getUTCDay();
  if ((wd === 0 || wd === 6) && !SURVEY.weekendsAreWorkdays) return false;
  return !SURVEY.holidays.includes(iso);
}
export function workdaysBetween(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const d = new Date(fromIso + "T12:00:00Z");
  const end = new Date(toIso + "T12:00:00Z");
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10);
    if (isWorkday(iso)) out.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
