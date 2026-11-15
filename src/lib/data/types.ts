/** Client-safe types for the processed dataset served by /api/data. */

export type Severity = "critical" | "major" | "minor" | "info";

export interface Flag {
  /** interview id ("" for interviewer-level flags) */
  iid: string;
  key: string;
  check: string;
  sev: Severity;
  cat: string;
  msg: string;
  interviewer: string | null;
  team: number | null;
  region: string | null;
  /** counts against the interview score? */
  scored: boolean;
}

export interface CheckDef {
  id: string;
  name: string;
  cat: string;
  sev: Severity | "varies";
  modes: string;
  scope: string;
  desc: string;
}

/** One row per interview (compact, client-facing). */
export interface Rec {
  id: string;
  key: string;
  assignmentId: number | null;
  estId: string | null;
  estName: string | null; // hidden for viewers
  region: string | null;
  regionCode: number | null;
  district: string | null;
  districtCode: number | null;
  team: number | null;
  interviewer: string | null; // GAESnn login
  supervisor: string | null;
  mode: number | null;
  disp: string;
  dispGroup: string;
  status: number | null;
  stage: string;
  rejections: number;
  date: string | null; // yyyy-mm-dd of start
  completeDate: string | null; // date of endtime / completion
  startTs: string | null;
  endTs: string | null;
  startHour: number | null;
  weekday: number | null; // 0 Sun..6 Sat
  activeMin: number | null;
  sessMin: number | null;
  timespent: number | null;
  medGapSec: number | null;
  pctFast: number | null;
  finMedGapSec: number | null;
  nAnswers: number;
  nChanges: number;
  nAfterEnd: number;
  nSessions: number;
  moduleMin: Record<string, number>;
  sessions: [number, number, number][]; // [startMs, endMs, answers]
  // economics (COMPLETE only)
  isic4: string | null;
  isicSection: string | null;
  sizeClass: string | null;
  emp24: number | null;
  emp25: number | null;
  female: number | null;
  ssnit: number | null;
  occ: (number | null)[]; // managers, professionals, clerical, production, elementary
  contract: (number | null)[]; // permanent, temporary, unpaid
  paid: number | null;
  wages: number | null;
  rev: number | null;
  opex: number | null;
  opexParts: (number | null)[]; // labour, trade goods, operating, services, financial, taxes
  capex: number | null;
  assets: number | null;
  liab: number | null;
  wpw: number | null;
  rpw: number | null;
  margin: number | null;
  zeroShare: number | null;
  heapShare: number | null;
  nonZeroMoney: number;
  roundThousands: number;
  records: boolean | null; // keeps financial records
  legalForm: number | null;
  registered: number | null;
  opStatus: number | null;
  femaleOwn: number | null;
  revChange: number | null;
  capacity: number | null;
  credit: number | null;
  creditSources: number[];
  exporter: number | null;
  importer: number | null;
  energy: (number | null)[]; // grid, solar, generator, biomass
  // GPS
  lat: number | null;
  lon: number | null;
  frameLat: number | null;
  frameLon: number | null;
  // quality
  score: number | null;
  band: string | null;
  nCritical: number;
  nMajor: number;
  nMinor: number;
  excluded: string | null; // reason excluded from analysis
  analysable: boolean; // passes rules for statistical outputs
  callback: string | null;
  /** questionnaire version the interview was collected with */
  qv: number;
  /** calls the interviewer made before the interview was completed (completed interviews only) */
  calls: number | null;
  /** question = answered in the questionnaire (v2+); comment = read from a supervisor/interviewer comment (v1) */
  callsSrc: "question" | "comment" | null;
  /** hours from completion to the supervisor's first decision */
  supLagH: number | null;
  /** minutes the supervisor had the interview open */
  supOpenMin: number | null;
  reviewUrl: string;
}

export interface InterviewerRow {
  login: string;
  code: number;
  name: string | null;
  team: number | null;
  assigned: number;
  attempted: number;
  complete: number;
  nonContact: number;
  refused: number;
  pending: number;
  perDay: number | null;
  coopRate: number | null;
  medDuration: number | null;
  meanScore: number | null;
  iqi: number | null;
  iqiParts: { S: number; C: number; T: number; R: number; H: number; Z: number } | null;
  rejections: number;
  submitted: number;
  heapShare: number | null;
  zeroShare: number | null;
  medGapSec: number | null;
  outsideHours: number | null;
  lastActivity: string | null;
  flags: string[]; // DQ-IB ids
  receivedOnTablet: number;
}

export interface TeamRow {
  team: number;
  supervisor: string;
  /** full name from Survey Solutions (falls back to the login) */
  supervisorName: string;
  interviewers: number;
  activeInterviewers: number;
  target: number;
  attempted: number;
  complete: number;
  meanScore: number | null;
  awaitingReview: number;
  medDecisionLagH: number | null;
  reviewed: number;
  rejectionRate: number | null;
  medOpenMin: number | null;
}

export interface Targets {
  national: number;
  byTeam: Record<string, number>;
  byInterviewer: Record<string, number>;
  byRegion: Record<string, number>;
  bySection: Record<string, number>;
  regionSource: "uploaded" | "none";
  updatedAt?: string;
}

export interface ItemNR {
  variable: string;
  label: string;
  module: string;
  enabled: number;
  missing: number;
  zero: number | null;
}

export interface QuestionTiming {
  variable: string;
  label: string;
  module: string;
  n: number;
  medianSec: number;
  p90Sec: number;
}

export interface Dataset {
  generatedAt: string;
  exportedAt: string | null;
  server: string;
  workspace: string;
  /** every questionnaire version found on the server; their interviews are merged into one dataset */
  questionnaires: {
    id: string; version: number; title: string;
    /** interview records / completed interviews collected with this version (after exclusions) */
    records: number; complete: number;
    /** questions this version has that the previous one did not, and the reverse */
    added: { variable: string; label: string }[]; removed: string[];
    firstDate: string | null; lastDate: string | null;
  }[];
  /** variable name of the call-attempts question and how many completed interviews could answer it */
  calls: { variable: string; label: string; sinceVersion: number | null };
  records: Rec[];
  /** test / out-of-window / duplicate records (shown only in the Excluded table) */
  excludedRecords?: Rec[];
  flags: Flag[];
  checks: CheckDef[];
  interviewers: InterviewerRow[];
  teams: TeamRow[];
  targets: Targets;
  itemNR: ItemNR[];
  questions: QuestionTiming[];
  isicSections: Record<string, string>;
  interviewerNames: Record<string, string>;
  /** supervisor login -> full name */
  supervisorNames: Record<string, string>;
  stages: { key: string; label: string }[];
  totals: { records: number; deleted: number; complete: number };
  survey: {
    fieldStart: string;
    fieldEnd: string;
    workdays: string[];
    holidays: string[];
    weekendsAreWorkdays: boolean;
    interviewersTotal: number;
  };
  pooled: { medDuration: number | null; heapShare: number | null; zeroShare: number | null };
  viewer: { role: string; regions: string[]; pii: boolean };
}
