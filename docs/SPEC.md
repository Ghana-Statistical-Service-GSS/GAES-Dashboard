# GAES 2026 Monitoring Dashboard — Specification

Version 1.0 · written 15 Nov 2026 · based on the Survey Solutions export of 15 Nov 2026 (96 interviews, 14,778 paradata events, 9,994 assignments), the questionnaire JSON (revision 2985), the interviewer manual and the overview slides.

Everything marked **[observed]** was measured on the 15 Nov export. Everything marked **[assumption]** is listed again in section 6 and must be a config constant, not a hard-coded literal.

---

## 1. Survey brief

| Item | Value |
|---|---|
| Survey | Ghana Annual Economic Survey (GAES) 2026, first round. GSS with the World Bank Group, under the Statistical Service Act, 2019 (Act 1003). |
| Objectives | (1) employment dynamics; (2) output, value added and productivity from revenues, expenses, investment, assets and liabilities; (3) access to finance; (4) capacity use and direct imports/exports; (5) evidence for job-creation and business-growth policy. |
| Unit of enumeration | The **establishment** (one physical location). Multi-site enterprises answer for the selected location only. No substitution, ever. |
| Frame and design | Business register from IBES Phase II (2024). About 10,000 establishments, stratified by region, sector and size. Weights not yet available, so every estimate in the dashboard is unweighted. The manual's sample-design paragraph is still a placeholder. |
| Sample size loaded | **9,994 assignments** (one establishment each, quantity 1, audio recording on, web mode off), created 12 Nov 2026 19:37 by HQ user `iamafisu`. |
| Reference period | Fiscal year 2025: the financial year must include at least 6 months of 2025. Values in Ghana cedis, in full (not thousands). |
| Timeline | Assignments loaded 12 Nov 2026. First interview 13 Nov 2026 09:29. Fieldwork ends **31 Dec 2026** (manual: "finish all assigned establishments by the end of December 2026"). 35 weekdays; 33 working days after removing 4 Dec (Farmers' Day) and 25 Dec [assumption]. |
| Modes | `interview_mode`: 1 CATI (default), 2 CAPI (face to face, on request), 3 CAWI/Web (self interview). Observed: 90 CATI, 5 CAPI, 0 Web, 1 not set. |
| Calling rules | 08:00–17:00 Monday–Friday unless the respondent asks otherwise. At least 6 attempts on different days and times before non-contact. About 30 minutes per interview. Submit by end of day. |
| Field organisation | 5 teams, 5 supervisors (`GAES01`–`GAES05`, supervisor of team *n* is `GAES0n`), 74 interviewers (`GAES06`–`GAES79`). HQ approves or rejects after the supervisor. |
| Reporting domains | Region (16), ISIC Rev. 5 section (22), employment size class. District is available (261 codes) but too thin for estimates. |
| Server | `https://survey.statsghana.gov.gh`, workspace `gaes`, questionnaire id `3f34334debb9445b986c666ad009527f`, version 1, export variable `gaes_data`. |

### 1.1 Targets (the dashboard computes coverage against these)

Region and sector targets are **not given in any document**, and the export's `assignment__actions.tab` does not carry the region. The only exact targets available today are national, by team and by interviewer:

| Level | Target | Source |
|---|---|---|
| National | 9,994 | count of distinct `assignment__id` with action 1 (Created) |
| Team 1 | 2,025 | 15 interviewers |
| Team 2 | 1,891 | 14 interviewers |
| Team 3 | 2,025 | 15 interviewers |
| Team 4 | 2,028 | 15 interviewers |
| Team 5 | 2,025 | 15 interviewers |
| Interviewer | 135 or 136 each | `assignment__actions.tab`, action 1, grouped by `responsible__name` |

**Region, district and ISIC-section targets** must be built at refresh time from the assignments API (`GET /gaes/api/v1/assignments?questionnaireId=...`, read `IdentifyingData` for `id04b`, `id05b`, `isic_code`) and cached as `data/targets.json` with shape `{ national, byRegion: {code: n}, byTeam, byInterviewer, bySection }`. Until that file exists, region pages show counts without a percentage and a notice "Region targets not loaded". Do not invent proportional targets.

Required pace **[assumption]**: 9,994 / 33 working days = 303 completed interviews per day, about 4.1 per interviewer per day. Observed so far: 33 completes on Fri 13 Nov, 37 on Sat 14 Nov.

### 1.2 Team roster (from the questionnaire's cascading categories; codes are the numeric part of `GAESnn`)

| Team (`id10`) | Supervisor | Interviewer codes (`id11b`) |
|---|---|---|
| 1 | GAES01 | 31–45 |
| 2 | GAES02 | 27–30, 46–55 |
| 3 | GAES03 | 6–20 |
| 4 | GAES04 | 23–26, 62, 63, 71–79 |
| 5 | GAES05 | 21, 22, 56–61, 64–70 |

Observed team-to-region pattern (not a rule): team 1 Greater Accra; team 2 Eastern; team 3 Bono, Ahafo, Ashanti; team 4 Central, Western, Volta, Western North; team 5 the five northern regions and Bono East.

---

## 2. Data dictionary essentials

### 2.1 Files and keys

| File | Grain | Key | Use |
|---|---|---|---|
| `gaes_data.tab` | interview (96 rows, 227 columns, no rosters) | `interview__id` (also `interview__key`, `assignment__id`) | all answers |
| `interview__diagnostics.tab` | interview | `interview__id` | status, responsible, rejections, `interview__duration`, `n_questions_unanswered` |
| `interview__actions.tab` | action | `interview__id` + order of rows | status pipeline and lags |
| `interview__comments.tab` | comment | `interview__id` | interviewer and supervisor comments |
| `interview__errors.tab` | error | `interview__id` | currently empty (header only) |
| `assignment__actions.tab` | assignment action (59,954 rows) | `assignment__id` | targets, tablet receipt |
| `paradata.tab` | event | `interview__id` + `order` | timing and behaviour |

Encoding: tab-separated, UTF-8 with BOM (strip `﻿` from the first header).

### 2.2 Missing values [observed]

| Representation | Meaning | Where seen |
|---|---|---|
| empty string | question disabled or never reached (skipped module, not a non-response) | all of modules 1–6 for non-contacts; conditional questions |
| `-999999999` | enabled but unanswered numeric or single-select | `m1qend`…`m6qend`, `m7q01` (supervisor questions), `id11a`, `interview_mode` in one case |
| `##N/A##` | enabled but unanswered text or date | `datetime` in one case |
| `0` / `1` | multi-select columns (`x__n`) and boolean variables | `m2q03__*`, `m2q04b__*`, `m3q07b__*`, `m3q08b__*`, `m6q03c__*`, `ownership_total`, `m3err1`, `m3err2` |

Helpers used by every check:

```
isMissing(v) := v == null or trim(v) == "" or v == "##N/A##" or Number(v) == -999999999
num(v)       := isMissing(v) ? null : Number(v)
answered(v)  := not isMissing(v)
```

There are **no "don't know" or "refused" codes** in this questionnaire. Item non-response shows up as `-999999999` (rare, because every numeric field must be filled to pass the totals validation) or, far more often, as a **typed zero**. Zero-filling is therefore the "don't know" proxy (checks DQ-CP-04, DQ-IB-05).

### 2.3 Identification (cover page; all preloaded from the frame except where noted)

| Variable | Meaning | Notes |
|---|---|---|
| `id01a` | **Establishment serial number** (frame id, the unit key) | integer, unique in the frame |
| `id01b` | Establishment name | |
| `id02` | Establishment telephone | 10 digits, all observed values start with 0 |
| `id04a`, `id04b` | Region name (upper case), **region code 1–16** | 1 Western, 2 Central, 3 Greater Accra, 4 Volta, 5 Eastern, 6 Ashanti, 7 Western North, 8 Ahafo, 9 Bono, 10 Bono East, 11 Oti, 12 Northern, 13 Savannah, 14 North East, 15 Upper East, 16 Upper West |
| `id05a`, `id05b` | District name, **district code** | `floor(id05b / 100) == id04b` (e.g. 304 is in region 3) |
| `id06`, `id07`, `id09` | Street, suburb/area, locality/town | |
| `isic_code`, `isic_desc` | **Preloaded 4-digit ISIC Rev. 5 class** and description | exported as a number, so a leading zero is lost (`111` means `0111`); left-pad to 4 |
| `id10` | Team number 1–5 | |
| `id11a`, `id11b`, `id11c` | Interviewer name, ID, contact | answered by the interviewer; all three carry the **same numeric code** *n*, where the login is `GAES` + 2-digit *n* |
| `id13__Latitude/Longitude` | **Frame GPS** of the establishment (preloaded) | `id13__Accuracy` = 0 and `id13__Timestamp` = 1970-01-01 on every row: it is not a field reading |
| `interview_mode` | Mode 1/2/3 | answered by the interviewer |
| `datetime` | Interview start, timestamp question | local time without offset; Ghana is UTC+0, so it compares directly with paradata `timestamp_utc`. Can be re-clicked (see DQ-TM-09) |
| `assignment__id`, `interview__key`, `interview__id` | Survey Solutions identifiers | |
| `sssys_irnd` | random number 0–1 per interview | use for the back-check sample |
| `has__errors` | count of invalid answers | 0 on all 96 |

There is no variable `id03`, `id08` or `id12`.

### 2.4 Outcome variables and derived disposition

Module 0 is enabled only when `interview_mode == 1`. Modules 1–7 are enabled by the macro
`start_interview := (interview_mode == 1 and m0q02a == 1) or (interview_mode in {2,3} and answered(datetime))`.

| Variable | Codes |
|---|---|
| `m0q01a` Did anyone answer the call | 1 Yes · 2 No, ring without answer · 3 No, number unreachable (wrong number) · 4 No, switched off |
| `m0q02a` Is the respondent available (asked if `m0q01a == 1`) | 1 Yes · 2 Yes, but language barrier · 3 No, busy · 4 No, call dropped · 5 No, refused / not interested |
| `m0q03a` language (if `m0q02a == 2`) | 1 English … 10 Dagaare/Waale, 96 other |
| `m0q04a`–`m0q07a` call-back date and time (if `m0q02a == 3`) | date, hours 1–12, minutes, 1 AM / 2 PM |
| `m1q14` operational status | 1 Active · 2 Temporarily suspended · 3 Ceased pending dissolution · 4 Dissolution or bankruptcy |

There is **no consent question, no final result code and no call-attempt counter**. The manual's outcome codes 01–09 are not in the instrument. Derive:

```
disp(r):
  mode = num(r.interview_mode)
  if mode == null: return "NOT_STARTED"
  if mode == 1:
    a = num(r.m0q01a); b = num(r.m0q02a)
    if a == null: return "NOT_STARTED"
    if a == 2: return "NO_ANSWER"
    if a == 3: return "UNREACHABLE"
    if a == 4: return "SWITCHED_OFF"
    if b == null: return "PARTIAL"
    if b == 2: return "LANGUAGE"
    if b == 3: return "CALLBACK"
    if b == 4: return "CALL_DROPPED"
    if b == 5: return "REFUSED"
  if answered(r.endtime) and answered(r.m6q03a): return "COMPLETE"
  return "PARTIAL"
```

Groups: **COMPLETE**; **PARTIAL**; **NON_CONTACT** = NO_ANSWER, UNREACHABLE, SWITCHED_OFF, CALL_DROPPED; **PENDING** = CALLBACK, LANGUAGE; **REFUSED**; **NOT_STARTED**.
Observed: COMPLETE 70, NO_ANSWER 9, REFUSED 5, UNREACHABLE 4, SWITCHED_OFF 4, CALLBACK 2, CALL_DROPPED 1, NOT_STARTED 1, PARTIAL 0.

Rates: contact rate = (COMPLETE + PARTIAL + REFUSED + PENDING) / attempted; cooperation rate = COMPLETE / (COMPLETE + PARTIAL + REFUSED); completion rate = COMPLETE / target; attempted = interviews with `disp != NOT_STARTED`.

### 2.5 Modules

| Module | Variables | Measures |
|---|---|---|
| Cover | `id*`, `isic_*`, `interview_mode`, `datetime` | identification, mode, start time |
| 0 Pre-call (CATI only) | `m0q01a`–`m0q07a` | call outcome, language, call-back |
| 1 Identification and classification | `m0q08` (CAPI GPS), `gpsAccuracy`, `m0q00a–d` respondent, `m0q09a`–`m0q16c` address confirmation, `m0q11`, `m0q15`, `m1q01a`–`m1q17`, `m1qend` | respondent, changes to frame data, TIN, start year, registration, ownership shares, legal form, establishment type, record keeping, free zone, operational status, female ownership |
| 2 Economic activities | `m2q00`–`m2q04b`, `m2qend` | confirmation of preloaded ISIC, re-coded main activity, secondary activity, sales reach, capacity utilisation |
| 3 Employment | `m3q01`–`m3q09b`, `m3qend` | workers 2024 and 2025, female, SSNIT-covered, by occupation, by contract type, degree share, foreign share, skills gap, training |
| 4 Expenses | `m4q01a`–`m4q05`, `m4qend` | 7 expense blocks, total, energy spend, direct imports |
| 5 Revenues | `m5q01a`–`m5q05`, `m5qend` | operating and non-operating revenue, change from 2024, direct exports |
| 6 Assets, liabilities, credit | `m6q01a`–`m6q03d`, `endtime`, `timespent`, `m6qend` | balance sheet, new credit, end time |
| 7 Supervisor only | `m7q01`, `m7q02` | supervisor sign-off |

`m1qend`…`m6qend` ("Have you reviewed this section?", 1 Yes / 2 No) and `m7q01` (1 reviewed and approve, 2 reviewed and approve with comment), `m7q02` are **supervisor-scope** questions. They are `-999999999` until a supervisor fills them, which is why `n_questions_unanswered` is exactly 7 on every unreviewed complete interview.

The manual describes 9 modules (finance, management, technology adoption). **Modules 7–9 of the manual are not in the deployed questionnaire**, and neither are hires, separations, vacancies, full-time/part-time or raw-material purchases.

### 2.6 Key quantitative variables (all cedis are annual, FY2025, full cedis)

| Concept | Variable(s) | Unit | Relation |
|---|---|---|---|
| Year began / registered | `m1q02`, `m1q04` | year | built-in ranges 1800–2026 and 1900–2025 |
| Ownership shares | `m1q06a` private national, `m1q06b` private foreign, `m1q06c` state | % | `ownership_total` is a **boolean** (1 = sums to 100 or not all answered), not a total |
| Female ownership | `m1q17` | % | |
| Capacity utilisation | `m2q04a` | % | |
| Workers 2024, 2025 | `m3q01`, `m3q02` | persons | |
| Female, SSNIT-covered | `m3q02a`, `m3q02b` | persons | each ≤ `m3q02` |
| By occupation | `m3q04a` managers, `b` professionals, `c` clerical, `d` production/service, `e` elementary | persons | sum = `m3q02`; `m3err1` boolean, 1 = OK |
| By contract | `m3q05a` permanent, `m3q05b` temporary, `m3q05c` unpaid | persons | sum = `m3q02`; `m3err2` boolean, 1 = OK |
| Degree share, foreign share | `m3q06`, `m3q07a` | % | |
| Employees trained | `m3q09b` | persons | ≤ `m3q02` |
| I Labour costs | `m4q01a` gross wages, `m4q01b` social security, `m4q01c_oth` other | GHS | `m4t1` = a + b + c_oth |
| II Materials and trade goods | `m4q01d` stock at start, `m4q01e` stock at end, `m4q01f` purchases of trade goods | GHS | `m4t2` = d + e + f (**see warning below**) |
| III General operating | `m4q01g` rent, `h` electricity, `i` water, `j` communication/IT, `k` other | GHS | `m4t3` |
| IV Professional services | `m4q01l` training, `m4q01m` other services | GHS | `m4t4` |
| V Financial | `m4q01n` interest, `o` bank charges, `p` other | GHS | `m4t5` |
| VI Taxes | `m4q01q` property, `r` corporate income, `s` VAT/sales, `t` other | GHS | `m4t6` |
| VII Capital investment | `m4q01u` land/buildings, `v` transport, `w` machinery, `x` other | GHS | `m4t7` |
| Total expenses | `m4t8` (computed), `m4q01y` (typed) | GHS | `m4t8` = `m4t1`+…+`m4t7`; `m4q01y` must equal `m4t8` |
| Energy spend | `m4q02a` grid, `b` solar, `c` diesel/petrol/gas generation, `d` biomass | GHS | `m4q02a` should equal `m4q01h` |
| Direct imports | `m4q03`, `m4q04`, `m4q05` | yes/no, % | |
| I Operating revenue | `m5q01a` production, `b` trade, `c` services, `d_oth` other | GHS | `m5t1` |
| II Non-operating revenue | `m5q01e`, `f`, `g`, `h`, `i_oth` | GHS | `m5t2` (label says "cost"; it is revenue) |
| Total revenue | `m5tt` (computed), `m5q01j` (typed) | GHS | `m5tt` = `m5t1` + `m5t2`; `m5q01j` must equal `m5tt` |
| Revenue change, exports | `m5q02` (1 up, 2 same, 3 down, 97 first year), `m5q03`, `m5q04`, `m5q05` | | |
| Assets | `m6q01a` tangible fixed, `b` current, `c` intangible, `d` right-of-use, `e_oth` other | GHS | `m6t1`; `m6q01_total` must equal `m6t1` |
| Liabilities | `m6q02a` payables, `b` short-term bank, `c_oth` short-term other, `d` long-term bank, `e_oth` long-term other | GHS | `m6t2`; `m6q02_total` must equal `m6t2` |
| New credit | `m6q03a`, `m6q03b` amount, `m6q03c__1..5,96` source, `m6q03d` (1 all, 2 most, 3 some, 99 none) | | |
| End time, elapsed | `endtime`, `timespent` | timestamp, minutes | `timespent` = whole minutes between `datetime` and `endtime` (wall clock, not active time) |

**Instrument warning (affects every expense estimate).** `m4t2` adds the opening stock **and** the closing stock to trade-goods purchases, and both stocks then flow into `m4t8` and `m4q01y`. The manual says the stocks are memo items that are not added, and it also lists "purchases of raw materials" (II.1), which the instrument does not ask. So `m4q01y` overstates expenses and is not usable as "total expenses". The dashboard must use the derived measures below and never publish `m4q01y`, `m4t2` or `m4t8` as estimates.

### 2.7 Derived analysis variables (compute once per interview, used by checks and outputs)

```
emp25 = num(m3q02); emp24 = num(m3q01)
paid  = num(m3q05a) + num(m3q05b)                       # paid employees
wages = num(m4q01a)
rev   = num(m5q01j)
opex  = num(m4t1) + num(m4q01f) + num(m4t3) + num(m4t4) + num(m4t5) + num(m4t6)   # no stocks, no capex
capex = num(m4t7)
assets = num(m6q01_total); liab = num(m6q02_total)
margin = rev > 0 ? (rev - opex) / rev : null
wpw    = paid > 0 ? wages / paid : null                 # wage per paid employee
rpw    = emp25 > 0 ? rev / emp25 : null                 # revenue per worker
isicFinal = (num(m2q00) == 2 and answered(m2q01b)) ? num(m2q01b) : num(isic_code)
isic4     = padStart(String(isicFinal), 4, "0"); division = int(isic4.slice(0,2)); section = SECTION(division)
sizeClass = emp25 == 0 ? "0" : emp25 <= 5 ? "Micro (1-5)" : emp25 <= 30 ? "Small (6-30)" : emp25 <= 100 ? "Medium (31-100)" : "Large (101+)"   # [assumption: IBES classes]
FIN_ITEMS = the 47 typed money items: m4q01a..m4q01x (24), m4q02a..d (4), m5q01a..m5q01i_oth (9), m6q01a..m6q01e_oth (5), m6q02a..m6q02e_oth (5)
zeroShare = count(FIN_ITEMS == 0) / 47
heapShare = count(FIN_ITEMS > 0 and value % 1000 == 0) / count(FIN_ITEMS > 0)
```

ISIC Rev. 5 section from division (taken from the questionnaire's own cascade):

| Sec | Letter | Name | Divisions |
|---|---|---|---|
| 1 | A | Agriculture, forestry and fishing | 01–03 |
| 2 | B | Mining and quarrying | 05–09 |
| 3 | C | Manufacturing | 10–33 |
| 4 | D | Electricity, gas, steam and air conditioning | 35 |
| 5 | E | Water supply, sewerage, waste | 36–39 |
| 6 | F | Construction | 41–43 |
| 7 | G | Wholesale and retail trade | 46–47 |
| 8 | H | Transportation and storage | 49–53 |
| 9 | I | Accommodation and food service | 55–56 |
| 10 | J | Publishing, broadcasting, content | 58–60 |
| 11 | K | Telecommunications, computer programming, information services | 61–63 |
| 12 | L | Financial and insurance | 64–66 |
| 13 | M | Real estate | 68 |
| 14 | N | Professional, scientific and technical | 69–75 |
| 15 | O | Administrative and support services | 77–82 |
| 16 | P | Public administration and defence | 84 |
| 17 | Q | Education | 85 |
| 18 | R | Human health and social work | 86–88 |
| 19 | S | Arts, sports and recreation | 90–93 |
| 20 | T | Other service activities | 94–96 |
| 21 | U | Households as employers | 97–98 |
| 22 | V | Extraterritorial organisations | 99 |

### 2.8 Survey Solutions codes

`interview__status`: -1 Deleted · 0 Restored · 20 Created · 40 SupervisorAssigned · 60 InterviewerAssigned · 65 RejectedBySupervisor · 80 ReadyForInterview · 85 SentToCapi · 95 Restarted · 100 Completed · 120 ApprovedBySupervisor · 125 RejectedByHeadquarters · 130 ApprovedByHeadquarters.
Observed: 100 → 65 interviews, 65 → 19, 120 → 8, 125 → 3, 60 → 1, 130 → 0.

Pipeline stage for the dashboard: `60, 80, 85, 95` In progress · `100` Awaiting supervisor · `65` Returned to interviewer · `120` Awaiting HQ · `125` Returned by HQ · `130` Approved by HQ (final).

`interview__actions.action`: 0 SupervisorAssigned · 1 InterviewerAssigned · 2 FirstAnswerSet · 3 Completed · 4 Restarted · 5 ApprovedBySupervisor · 6 ApprovedByHeadquarter · 7 RejectedBySupervisor · 8 RejectedByHeadquarter · 9 Deleted · 10 Restored · 11 UnapprovedByHeadquarter · 12 Created · 13 InterviewReceivedByTablet · 14 Resumed · 15 Paused · 16 TranslationSwitched · 17 OpenedBySupervisor · 18 ClosedBySupervisor · 19 InterviewSwitchedToCawiMode · 20 InterviewSwitchedToCapiMode · 21 InterviewReceivedBySupervisor.
Roles: 0 unknown · 1 Interviewer · 2 Supervisor · 3 Headquarter · 4 Administrator · 5 API user. HQ rejections appear with originator `Unknown`, role 0.
Action 20 fires on every interview at creation: it is the app's entry mode and has **nothing to do with `interview_mode`**.

`assignment__actions.action`: 1 Created · 2 Archived · 3 Deleted · 4 ReceivedByTablet · 5 Unarchived · 6 AudioRecordingChanged · 7 Reassigned · 8 QuantityChanged · 9 WebModeChanged · 10 TargetAreaChanged · 11 Completed · 12 Closed · 13 Reopened.

Paradata events used: `AnswerSet` (parameters `variable||value||rosterVector`), `AnswerRemoved`, `Resumed`, `Paused`, `Completed`, `Restarted`, `ReceivedBySupervisor`, `OpenedBySupervisor`, `ClosedBySupervisor`, `ApproveBySupervisor`, `RejectedBySupervisor`, `RejectedByHeadquarter`, `QuestionDeclaredInvalid`, `CommentSet`. Ignore `VariableSet`, `VariableEnabled`, `VariableDisabled` and all events whose timestamp equals the `InterviewCreated` timestamp (the preload burst).

### 2.9 Paradata-derived timing variables

Let `E` = events of the interview with `role == 1`, ordered by `order`, excluding the preload burst.

```
tStart   = timestamp of the FIRST AnswerSet of "datetime"
tEnd     = timestamp of the LAST AnswerSet of "endtime"
activeMin = sum over consecutive events in E with tStart <= t <= tEnd of min(gap, 300 s) / 60
sessMin   = interview__duration from diagnostics (format DD.HH:MM:SS) in minutes   # equals sum of Resumed→Paused
nSessions = count of Resumed→Paused pairs
ANS       = AnswerSet events in E whose variable is not id*, isic*, interview_mode, datetime
medGapSec = median gap between consecutive ANS events
pctFast   = share of those gaps < 2 s
finMedGapSec = median gap preceding ANS events whose variable starts with m4q, m5q or m6q0
nChanges  = sum over variables of (AnswerSet count - 1);  nRemoved = count AnswerRemoved
nAfterEnd = count of ANS events with timestamp > tEnd
nDatetimeSets, nEndtimeSets, nModeSets = AnswerSet counts for datetime, endtime, interview_mode
nCompleted = count of Completed events
completedAt = first Completed; receivedAt = first ReceivedBySupervisor after it; decidedAt = first ApproveBySupervisor or RejectedBySupervisor
supOpenMin  = sum of OpenedBySupervisor→ClosedBySupervisor
```

`duration` in every timing check means `activeMin`; fall back to `sessMin` if paradata is missing. Never use `timespent` as the duration (see observed values in 3.3).

---

## 3. Data quality check catalogue

### 3.1 Conventions

* **Severity**: `critical` (data cannot be used or suggests fabrication; must be resolved), `major` (likely error; call back or correct), `minor` (review; may be genuine), `info` (context only, never scored).
* **Scope**: unless stated, a check runs only on `disp == COMPLETE`. `ALL` means every interview row. Deleted interviews (`status == -1`) are dropped before anything else.
* **Modes**: C = CATI, P = CAPI, W = Web.
* Pseudo-code uses `and`, `or`, `not`. A check never fires when a value it needs is missing, unless the check is about missingness.
* Each flag record: `{ interview__id, interview__key, id01a, check_id, severity, category, message, values, interviewer, team, region, raised_at }`.
* All thresholds live in one config object so HQ can tune them.

Checks total: **104** (ID 8, DU 6, CP 9, TM 14, AR 8, CN 24, RO 8, GP 6, MD 5, PR 7, IB 9). Categories: Identification, Duplication, Completeness, Timing, Arithmetic, Consistency, Range-Outlier, GPS, Mode-specific, Process, Interviewer-behaviour.

### 3.2 Identification and scope (DQ-ID)

| ID | Name | Sev | Modes | Scope | Logic | Rationale | Message |
|---|---|---|---|---|---|---|---|
| DQ-ID-01 | Interviewer ID does not match login | critical | CPW | ALL, `answered(id11b)` | `"GAES" + pad2(num(id11b)) != diagnostics.responsible` **and** it differs from the `responsible` of the interview's first `AnswerSet` with role 1 | Manual 8.4: never work under someone else's login. 0 observed | Interviewer code {id11b} recorded, but the interview was done under login {responsible}. |
| DQ-ID-02 | Interviewer name, ID and contact disagree | major | CPW | ALL, any answered | `not (num(id11a) == num(id11b) and num(id11b) == num(id11c))`, or any of the three missing while `disp != NOT_STARTED` | The three share one code. 1 observed (all missing) | Interviewer name/ID/contact codes differ or are blank ({id11a}/{id11b}/{id11c}). |
| DQ-ID-03 | Interviewer not in the stated team | major | CPW | ALL | `TEAM_OF[num(id11b)] != num(id10)` (roster in 1.2) | Establishment worked by another team's interviewer | Interviewer GAES{id11b} belongs to team {x} but the case is in team {id10}. |
| DQ-ID-04 | District code not in region | major | CPW | ALL | `floor(num(id05b)/100) != num(id04b)`; if `num(m0q16a) == 1` also test `floor(num(m0q16c)/100) != num(m0q16b)` | Frame integrity | District {id05b} is not in region {id04b}. |
| DQ-ID-05 | Interview outside the fieldwork window | critical | CPW | ALL | `date(datetime) < FIELD_START (2026-11-13)` or `datetime > exportTime + 1 h` or (`answered(endtime)` and `endtime < datetime`) | Pre-fieldwork test data, wrong device clock. 0 observed | Start {datetime} / end {endtime} is outside the fieldwork window or out of order. |
| DQ-ID-06 | Test or training record | critical | CPW | ALL | regex `/\b(test|testing|dummy|training|trial|xxx+|asdf)\b/i` matches `id01b`, `m0q00a` or `m0q09b` | Purge from analysis | Looks like a test record ("{text}"). |
| DQ-ID-07 | Mode not recorded | major | CPW | ALL, `status >= 100 or status == 65` | `isMissing(interview_mode) or isMissing(datetime)` | Mode gates every module. Observed once in status 60 (interviewer removed mode and start time after 81 answers) — report that case as info | Interview mode or start time is blank. |
| DQ-ID-08 | Establishment ceased before the reference year | major | CPW | COMPLETE, `num(m1q14) in {2,3,4}` and `m1q14a` matches `^(\d{2})/(\d{4})$` | `(yyyy < 2025)` and `(rev > 0 or emp25 > 0)`; also fire if month not in 1–12 or year not in 1990–2026 | Out of scope for FY2025 yet data reported. Observed: one ceased 01/2024 with all zeros (fine), one suspended 01/2025 with revenue 3,000 | Stopped operating {m1q14a} but FY2025 revenue {rev} / workers {emp25} reported. |

### 3.3 Duplication (DQ-DU) — scope ALL

| ID | Name | Sev | Modes | Logic | Rationale | Message |
|---|---|---|---|---|---|---|
| DQ-DU-01 | Duplicate establishment | critical | CPW | more than one interview with the same `num(id01a)` | Manual 9.2: a duplicate is the same questionnaire ID twice. 0 observed | Establishment {id01a} has {n} interviews: {keys}. |
| DQ-DU-02 | Assignment with more than one interview | critical | CPW | more than one interview with the same `assignment__id` | Quantity is 1 per assignment | Assignment {assignment__id} has {n} interviews. |
| DQ-DU-03 | Same establishment phone on different establishments | major | CPW | group by `normPhone(m0q10b if num(m0q10a)==1 else id02)`, group size > 1 with different `id01a` | Frame duplicate or wrong unit. `normPhone` = digits only, drop a leading 233, left-pad to 10 with 0 | Phone {phone} is used by establishments {ids}. |
| DQ-DU-04 | Same respondent phone on different establishments | major | CPW | group by `normPhone(m0q00b)` among COMPLETE, size > 1 with different `id01a` | One person answering for several units, or fabrication. 0 observed | Respondent phone {phone} appears in {n} interviews. |
| DQ-DU-05 | Respondent phone is a field officer's phone | critical | CPW | `normPhone(m0q00b)` is in the set of interviewer contact numbers (labels of `id11c`, 74 numbers; load from the `.do` file or `Categories/349dc21e….xlsx`) | Fabrication signal | Respondent phone {phone} belongs to interviewer {name}. |
| DQ-DU-06 | Same establishment name in the same district | minor | CPW | group by `normName(m0q09b if num(m0q09a)==1 else id01b)` + `id05b`, size > 1; `normName` = upper case, strip punctuation and the tokens LTD, LIMITED, ENT, ENTERPRISE(S), CO, COMPANY, VENTURES, collapse spaces | Possible frame duplicate | "{name}" appears {n} times in district {id05a}. |

### 3.4 Completeness (DQ-CP)

| ID | Name | Sev | Modes | Scope | Logic | Rationale | Message |
|---|---|---|---|---|---|---|---|
| DQ-CP-01 | Key variable missing | critical | CPW | COMPLETE | any of `m1q02, m1q14, m3q01, m3q02, m4q01a, m4q01y, m5q01j, m6q01_total, m6q02_total, m6q03a` is missing | These drive every output. 0 missing on 70 observed | Key value missing: {vars}. |
| DQ-CP-02 | Unanswered interviewer questions | major | CPW | `status >= 100` and started | `realUnanswered = n_questions_unanswered - count(isMissing(x) for x in [m1qend, m2qend, m3qend, m4qend, m5qend, m6qend, m7q01])`; fire if `realUnanswered > 0` | The raw counter is 7 on every unreviewed interview because of the supervisor questions. Subtract them | {realUnanswered} question(s) left unanswered. |
| DQ-CP-03 | Partial interview submitted | major | CPW | `disp == PARTIAL` and `status >= 100` | always | Manual 9.6: no partial saves at clearance | Interview submitted before the end (no end time or credit question). |
| DQ-CP-04 | Zero-filled financial modules | major | CPW | COMPLETE, `num(m1q14) == 1` | `zeroShare >= 0.90`; escalate to **critical** if `zeroShare == 1` | No "don't know" code exists, so zeros stand in. Observed zeroShare: min 0.45, median 0.72, p75 0.81, max 1.00; 4 active establishments at 0.90 or more | {pct}% of the 47 money items are zero for an active establishment. |
| DQ-CP-05 | Active establishment with no revenue | major | CPW | COMPLETE, `num(m1q14) == 1` | `rev == 0` | 1 observed (wages 78,000, revenue 0) | Active establishment reports zero revenue. |
| DQ-CP-06 | Active establishment with no workers | major | CPW | COMPLETE, `num(m1q14) == 1` | `emp25 == 0` | Working owners count as workers (manual 3.4). 1 observed | Active establishment reports zero workers in 2025. |
| DQ-CP-07 | Respondent details incomplete | minor | CP | COMPLETE | `isMissing(m0q00a)` or `normPhone(m0q00b)` does not match `^0[235]\d{8}$` or `length(trim(m0q00a)) < 3` | Needed for back-checks and next year's panel. 1 observed | Respondent name or phone missing/invalid. |
| DQ-CP-08 | No financial records kept | info | CPW | COMPLETE | `num(m1q09) == 2` | 41 of 70 observed. Money values are respondent estimates; tag `fin_source = "estimate"` for analysis | Establishment keeps no financial records; values are estimates. |

Item non-response rate (shown on the Data Quality page, not a flag): for each variable *v* in modules 1–6, `enabled(v)` = COMPLETE interviews where the question's enablement condition holds (conditions in 3.12); `INR(v) = count(isMissing(v) and enabled) / count(enabled)`. For money items also show `zeroRate(v)`.

### 3.5 Timing (DQ-TM)

Observed on 70 complete interviews: `activeMin` min 12.8, p5 16.9, p10 21.2, median 34.9, p75 44.8, p90 65.4, max 125.8. `sessMin` median 43.9, max 152.2. `timespent` median 37 but p90 1,152 and max 1,594 minutes, because 16 interviews were paused and finished hours or a day later. A complete interview has 104–155 answers; `medGapSec` min 3.9, median 6.9; `pctFast` median 4%, max 10%; `finMedGapSec` min 3.2, median 8.5.

| ID | Name | Sev | Modes | Scope | Logic | Rationale | Message |
|---|---|---|---|---|---|---|---|
| DQ-TM-01 | Interview impossibly short | critical | CP | COMPLETE | `duration < 10` | At least 104 answers; under 10 minutes is under 6 s per question including reading. Below the observed minimum (12.8) | Completed in {duration} min (design: about 30). |
| DQ-TM-02 | Interview very short | major | CP | COMPLETE | `10 <= duration < 15` | Half the design length; below p5 (16.9). 2 observed | Completed in {duration} min. |
| DQ-TM-03 | Interview very long | minor | CP | COMPLETE | `duration > 120` (CAPI: `> 150`) | Four times the design; 1 observed (125.8) | Active time {duration} min. |
| DQ-TM-04 | Web interview too short | major | W | COMPLETE | `duration < 8` | Self-completion needs no reading aloud; no observed data, so tune after the first 30 Web cases | Web form completed in {duration} min. |
| DQ-TM-05 | Answers entered too fast | major | CP | COMPLETE | `medGapSec < 3` or `pctFast > 0.20` | Observed minimum median gap 3.9 s; maximum fast share 10% | Median {medGapSec}s between answers; {pctFast}% under 2 s. |
| DQ-TM-06 | Financial items entered too fast | major | CP | COMPLETE, `zeroShare < 0.9` | `finMedGapSec < 3` | Manual 7.4.8: read each value back. Observed minimum 3.2 s | Money items entered every {finMedGapSec}s. |
| DQ-TM-07 | Started outside calling hours | minor | C | ALL with `datetime` | `hour(datetime) < 7 or hour(datetime) >= 19` | Rule is 08:00–17:00; one hour tolerance each side plus evening call-backs to 19:00. Observed starts: 20 of 95 at 19:00 or later | Call started at {HH:MM}. |
| DQ-TM-08 | Night-time interview | major | CP | ALL with `datetime` | `hour(datetime) >= 22 or hour(datetime) < 6`, or the same test on `endtime` | Nobody answers business calls at night. 0 observed | Interview at {HH:MM}. |
| DQ-TM-09 | Start time re-stamped | major | CPW | ALL | `nDatetimeSets > 1` | `datetime` is a timestamp button; pressing it again rewrites the start. Observed 5 (one shows timespent 10 min against 49 active) | Start time was reset {n} times; recorded start is not the real start. |
| DQ-TM-10 | Recorded elapsed time disagrees with active time | minor | CP | COMPLETE | `abs(num(timespent) - duration) > max(15, 0.5 * duration)` | Shows interruptions. Observed 20 of 70. The supervisor screen (`m7q01`) displays `timespent`, so supervisors see a misleading number | Recorded {timespent} min, active {duration} min. |
| DQ-TM-11 | Interview spread over more than one day | minor | CP | COMPLETE | `date(endtime) != date(datetime)` | Legitimate for records look-up, but worth a look. Observed 8 | Started {datetime}, ended {endtime}. |
| DQ-TM-12 | Many answers after the end stamp | minor | CP | COMPLETE | `nAfterEnd > 10` | End stamped before the interview finished, or post-hoc editing. Observed p90 = 10; maximum 90 | {nAfterEnd} answers were entered after the end time was stamped. |
| DQ-TM-13 | Overlapping interviews by one interviewer | major | CP | COMPLETE pairs, same `id11b` | two interviews whose **active sessions** (Resumed→Paused intervals containing at least 10 ANS events each) overlap by more than 5 minutes | One person cannot run two calls. Use sessions, not `datetime`–`endtime` windows: 14 window overlaps observed are all pause artefacts, and 8 raw session overlaps were observed, several of them idle sessions of exactly 15 minutes (the app's auto-pause), which is why each session must hold at least 10 answers. The rule has not been run on the data yet, so expect 0–3 hits | Sessions overlap by {m} min with interview {otherKey}. |
| DQ-TM-14 | Rapid succession | major | CP | COMPLETE, same `id11b`, ordered by `tStart` | `tStart(next) - tEnd(prev) < 2 min` for two complete interviews, or 3 or more complete interviews with `tEnd` inside any 60-minute window | 3 completes in 60 min would mean under 20 min each including dialling. Observed minimum gap 1.2 min | {n} interviews completed within {m} min. |

Weekend work is shown as `info` (DQ-TM-07 message suffix "weekend") because Saturday 14 Nov had 37 completes and the manual allows respondent-requested times.

### 3.6 Arithmetic (DQ-AR) — scope COMPLETE, all modes

The instrument already enforces these as errors, and all 70 complete interviews pass. Recompute anyway (errors do not block submission in Survey Solutions, and Web mode behaves the same). Tolerance `abs(diff) > 0.5`.

| ID | Name | Sev | Logic | Message |
|---|---|---|---|---|
| DQ-AR-01 | Ownership shares do not sum to 100 | critical | `num(m1q06a) + num(m1q06b) + num(m1q06c) != 100` or `num(ownership_total) == 0` | Ownership shares sum to {sum}%. |
| DQ-AR-02 | Occupation breakdown ≠ total workers | critical | `m3q04a+b+c+d+e != m3q02` or `num(m3err1) == 0` | Workers by occupation sum to {sum}; total is {m3q02}. |
| DQ-AR-03 | Contract breakdown ≠ total workers | critical | `m3q05a+b+c != m3q02` or `num(m3err2) == 0` | Workers by type sum to {sum}; total is {m3q02}. |
| DQ-AR-04 | Sub-group exceeds total workers | critical | `m3q02a > m3q02` or `m3q02b > m3q02` or (`answered(m3q09b)` and `m3q09b > m3q02`) | Female / SSNIT-covered / trained workers exceed total workers. |
| DQ-AR-05 | Expense total ≠ sum of blocks | critical | recompute `t1..t7` from the items; fire if any `m4tN` differs from its recomputed sum, or `m4q01y != sum(t1..t7)` | Total expenses {m4q01y} ≠ sum of blocks {sum}. |
| DQ-AR-06 | Revenue total ≠ sum of items | critical | `m5q01j != (m5q01a+b+c+d_oth) + (m5q01e+f+g+h+i_oth)` | Total revenue {m5q01j} ≠ sum of items {sum}. |
| DQ-AR-07 | Asset or liability total ≠ sum of items | critical | `m6q01_total != m6q01a+b+c+d+e_oth` or `m6q02_total != m6q02a+b+c_oth+d+e_oth` | Total assets/liabilities do not equal the items. |
| DQ-AR-08 | Percentage out of range or negative money | critical | any of `m1q17, m2q04a, m3q06, m3q07a, m4q04, m4q05, m5q04, m5q05` outside 0–100 when answered; or any FIN_ITEM < 0; or `m3q01 < 0`, `m3q02 < 0`; or `m1q02` outside 1800–2026 | {var} = {value} is outside the valid range. |

### 3.7 Logical consistency (DQ-CN) — scope COMPLETE, all modes

`MIN_WAGE_ANNUAL = 6470` GHS [assumption: 2025 national daily minimum wage GHS 19.97 × 27 days × 12 months]. Observed `wpw` among 55 interviews with paid staff and wages > 0: median about 6,000.

| ID | Name | Sev | Logic | Rationale / observed | Message |
|---|---|---|---|---|---|
| DQ-CN-01 | Paid employees but no wages | major | `paid > 0 and wages == 0` | 10 observed | {paid} paid employees but gross wages are zero. |
| DQ-CN-02 | Wages but no paid employees | major | `paid == 0 and wages > 0` | 2 observed | Wages of {wages} with no permanent or temporary employees. |
| DQ-CN-03 | Wage per employee far below minimum wage | major | `paid > 0 and wages > 0 and wpw < 0.25 * MIN_WAGE_ANNUAL` | Manual 11.13: "a much lower value usually means wages or workers are wrongly recorded"; likely a monthly figure. 13 observed | GHS {wpw} per paid employee per year (minimum wage is about {MIN_WAGE_ANNUAL}). Monthly figure entered? |
| DQ-CN-04 | Wage per employee below minimum wage | minor | `paid > 0 and wages > 0 and 0.25 * MIN <= wpw < MIN` | 10 observed | GHS {wpw} per paid employee per year is below the minimum wage. |
| DQ-CN-05 | Wage per employee implausibly high | major | `wpw > 300000` | Above GHS 25,000 a month on average; extra zero? Observed maximum 66,000 | GHS {wpw} per paid employee per year. Extra zero? |
| DQ-CN-06 | Large operating loss | major | `rev > 0 and opex > 3 * rev` | Manual: confirm a large loss. 8 observed (worst: opex 797,529 against revenue 5,000) | Operating expenses {opex} are {x} times revenue {rev}. |
| DQ-CN-07 | Operating loss | minor | `rev > 0 and 1.5 * rev < opex <= 3 * rev` | 11 observed | Operating expenses {opex} exceed revenue {rev} by more than half. |
| DQ-CN-08 | Implausibly high margin | minor | `rev >= 12000 and opex < 0.05 * rev` | Expenses missed. 1 observed | Operating expenses are only {pct}% of revenue. |
| DQ-CN-09 | Wages exceed revenue | minor | `rev > 0 and wages > rev` and DQ-CN-06 did not fire | 9 observed, most overlap CN-06 | Gross wages {wages} exceed total revenue {rev}. |
| DQ-CN-10 | Degree share looks like a head-count | major | `num(m3q06) > 0 and emp25 > 0 and num(m3q06) * emp25 / 100 < 0.5` | Supervisors already rejected two interviews for this. 5 observed | {m3q06}% of {emp25} workers is less than one person. A number was entered instead of a percentage. |
| DQ-CN-11 | Foreign share looks like a head-count | major | same test on `m3q07a` | Same mechanism | {m3q07a}% of {emp25} workers is less than one person. |
| DQ-CN-12 | Large change in workers 2024→2025 | minor | `abs(emp25 - emp24) >= 10 and (emp25 > 3 * emp24 or emp24 > 3 * emp25)` | 1 observed (80 → 0) | Workers went from {emp24} to {emp25}. |
| DQ-CN-13 | Start year inconsistent with 2024 data | minor | (`num(m1q02) >= 2025 and emp24 > 0`) or (`num(m1q02) >= 2025 and num(m5q02) != 97`) or (`num(m1q02) < 2025 and num(m5q02) == 97`) or `num(m1q02) == 2026` | 1 interview observed (began 2025, reports 2024 workers and a revenue comparison) | Began in {m1q02} but reports 2024 workers / a revenue comparison with 2024. |
| DQ-CN-14 | Registered before it began | minor | `answered(m1q04) and num(m1q04) < num(m1q02)` | 0 observed | Registered {m1q04}, began {m1q02}. |
| DQ-CN-15 | Legal form inconsistent | minor | (`num(m1q07) in {3,4} and num(m1q03) == 2`) or (`num(m1q07) == 1 and num(m1q17) not in {0,100}`) or (`num(m1q07) == 1 and num(m1q06c) > 0`) | A limited company is registered by definition; a sole proprietor is one person. 1 observed | Legal form {label} does not fit registration / ownership answers. |
| DQ-CN-16 | TIN format invalid | minor | `num(m1q01a) == 1` and `upper(trim(m1q01))` matches neither `^[A-Z]\d{10}$` nor `^GHA-\d{9}-\d$` | GRA TIN or Ghana Card PIN. 2 of 9 observed ("POO5139427", "not available with him") | TIN "{m1q01}" is not a valid TIN or Ghana Card number. |
| DQ-CN-17 | Electricity cost ≠ grid electricity | minor | `num(m4q01h) != num(m4q02a)` | Manual 4.2: must match. 20 of 70 observed | Electricity {m4q01h} in expenses but {m4q02a} for grid electricity. |
| DQ-CN-18 | Trade purchases and trade revenue disagree | minor | (`num(m4q01f) > 0 and num(m5q01b) == 0`) or (`num(m5q01b) > 0 and num(m4q01f) == 0`) | Manual 11.13. 3 + 3 observed | Trade goods purchased {m4q01f}, trade revenue {m5q01b}. |
| DQ-CN-19 | Social security workers and cost disagree | minor | (`num(m3q02b) > 0 and num(m4q01b) == 0`) or (`num(m4q01b) > 0 and num(m3q02b) == 0`) | 3 + 1 observed | {m3q02b} workers covered by SSNIT but social security cost is {m4q01b}. |
| DQ-CN-20 | Loan received but no liabilities | minor | `num(m6q03a) == 1 and num(m6q03d) in {1,2,3} and liab == 0` | 6 of 9 borrowers observed | Received a loan of {m6q03b} in 2025 but total liabilities are zero. |
| DQ-CN-21 | Bank debt and interest disagree | minor | (`num(m6q02b) + num(m6q02d) > 0 and num(m4q01n) == 0`) or (`num(m4q01n) > 0 and liab == 0 and num(m6q03a) == 2`) | 2 + 4 observed | Bank liabilities {x} with interest paid {m4q01n}. |
| DQ-CN-22 | Tangible assets below this year's investment | minor | `num(m6q01a) < num(m4q01u) + num(m4q01v) + num(m4q01w)`; also fire when `assets == 0 and num(m1q14) == 1 and rev > 0` | 14 and 18 observed | Tangible fixed assets {m6q01a} are below 2025 capital investment {x}. |
| DQ-CN-23 | Trade answers inconsistent | minor | (`num(m5q03) == 1 and m2q03__3 + m2q03__4 + m2q03__5 == 0`) or (`num(m5q03) == 1 and num(m5q04) == 0 and num(m5q05) == 0`) or (`num(m4q03) == 1 and num(m4q04) == 0 and num(m4q05) == 0`) or (`num(m5q03) == 2 and m2q03__3 + m2q03__4 + m2q03__5 > 0`) | Manual 11.13: exports against sales reach | Export/import answers do not agree with sales reach or shares. |
| DQ-CN-24 | Capacity and status inconsistent | minor | (`num(m2q04a) == 0 and rev > 0`) or (`num(m1q14) in {3,4} and (rev > 0 or emp25 > 0)`) or (`num(m1q14) == 2 and emp25 == 0 and rev > 100000`) | 1 + 0 + 1 observed (suspended, 0 workers, revenue 1.5 million) | Capacity/operational status does not fit reported revenue {rev} and workers {emp25}. |

### 3.8 Range and outliers (DQ-RO) — scope COMPLETE, all modes

Robust outlier rule used by RO-01 to RO-05:

```
values x > 0 only; y = log10(x)
group = ISIC section if the section has >= 20 valid values, else all sections pooled
if group n < 20: do not compute (show "too few cases")
med = median(y); MAD = median(|y - med|); if MAD == 0: skip
mz = 0.6745 * (y - med) / MAD
minor if |mz| > 3.5; major if |mz| > 5
```

Rationale: money values are heavily right-skewed (revenue p25 6,000, median 21,000, p75 125,000, max 7.2 million), so the log scale and median/MAD are needed; 3.5 is the usual Iglewicz–Hoaglin cut-off. With 70 cases only the pooled group works today.

| ID | Variable | Sev | Message |
|---|---|---|---|
| DQ-RO-01 | `rev` | minor / major | Total revenue {rev} is {direction} for {group} (median {median}). |
| DQ-RO-02 | `opex` | minor / major | Operating expenses {opex} are {direction} for {group}. |
| DQ-RO-03 | `emp25` | minor / major | {emp25} workers is {direction} for {group}. |
| DQ-RO-04 | `rpw` (revenue per worker) | minor / major | Revenue per worker {rpw} is {direction} for {group}. |
| DQ-RO-05 | `assets` | minor / major | Total assets {assets} are {direction} for {group}. |

Absolute rules (no distribution needed):

| ID | Name | Sev | Logic | Rationale | Message |
|---|---|---|---|---|---|
| DQ-RO-06 | Revenue too small to be annual cedis | major | `0 < rev < 1200` | Under GHS 100 a month; monthly value or thousands entered. 2 observed (1,000 and 1,000) | Annual revenue of GHS {rev}. Monthly figure or thousands? |
| DQ-RO-07 | Single item dominates implausibly | major | any FIN_ITEM `> 100 * rev` when `rev > 0`, or `assets > 1000 * rev` when `rev >= 1200`, or any FIN_ITEM `>= 1e9` | Misplaced zeros. 1 observed (wages 660,908 against revenue 5,000). Also worth a manual look: assets 10,010,000 against revenue 126,250 (ratio 79) | {var} = {value} against revenue {rev}. Check the number of zeros. |
| DQ-RO-08 | Worker count implausible for legal form or year | minor | `emp25 > 500`, or (`num(m1q07) == 1 and emp25 > 50`), or `num(m1q02) < 1900` | Largest observed 31 workers; earliest start 1986 | {emp25} workers / began in {m1q02}. |

### 3.9 GPS (DQ-GP) — scope `interview_mode == 2` and modules started

Observed on 5 CAPI interviews: accuracy 3.2–4.3 m; all within about 20 m of the frame point `id13`. Frame GPS of all 96 establishments falls inside its region's bounding box.

```
GHANA_BBOX = lat 4.5..11.5, lon -3.5..1.5
haversine(lat1, lon1, lat2, lon2) in metres
REGION_BBOX (lat min, lat max, lon min, lon max), from geoBoundaries ADM1:
 1 Western 4.739 6.135 -3.111 -1.439      9 Bono 6.836 8.787 -3.110 -1.894
 2 Central 5.032 6.299 -2.179 -0.388     10 Bono East 7.172 8.775 -2.122 0.215
 3 Greater Accra 5.482 6.035 -0.499 0.672 11 Oti 7.089 8.775 -0.391 0.731
 4 Volta 5.771 7.305 0.059 1.200         12 Northern 8.232 10.322 -1.368 0.567
 5 Eastern 5.725 7.196 -1.247 0.295      13 Savannah 7.993 10.082 -2.780 -0.142
 6 Ashanti 5.855 7.621 -2.448 -0.200     14 North East 9.931 10.714 -1.638 0.418
 7 Western North 5.341 7.016 -3.261 -2.077 15 Upper East 10.274 11.175 -1.573 0.034
 8 Ahafo 6.387 7.342 -2.868 -1.851       16 Upper West 9.636 11.021 -2.941 -1.424
```

| ID | Name | Sev | Logic | Rationale | Message |
|---|---|---|---|---|---|
| DQ-GP-01 | CAPI interview without GPS | major | `isMissing(m0q08__Latitude) or isMissing(m0q08__Longitude)` | The only proof of a visit; the question is not mandatory | Face-to-face interview has no GPS reading. |
| DQ-GP-02 | GPS outside Ghana | critical | point outside `GHANA_BBOX`, or lat and lon both 0 | Invalid fix or mock location | GPS ({lat}, {lon}) is outside Ghana. |
| DQ-GP-03 | GPS outside the establishment's region | major | point outside `REGION_BBOX[regionCode]` widened by 0.1° on each side, where `regionCode = num(m0q16b)` if `num(m0q16a) == 1` else `num(id04b)`. Better: point-in-polygon on the region GeoJSON if loaded | 0.1° is about 11 km of tolerance for boundary establishments | GPS is outside {region}. |
| DQ-GP-04 | Far from the frame location | minor / major / critical | `d = haversine(m0q08, id13)`; minor if `40 < d <= 500`, major if `500 < d <= 5000`, critical if `d > 5000` | Built-in warning is 40 m. 500 m allows a frame point on the wrong side of a market; 5 km is a different place | Interview taken {d} m from the establishment's recorded location. |
| DQ-GP-05 | Poor GPS accuracy | minor / major | minor if `5 < m0q08__Accuracy <= 20`; major if `> 20` | Built-in error is 5 m | GPS accuracy {acc} m. |
| DQ-GP-06 | GPS reading suspicious | major | `abs(m0q08__Timestamp - datetime) > 30 min` (minor), or the same lat and lon rounded to 5 decimals on two interviews with different `id01a` (major) | Reading taken away from the interview, or copied. 1 observed (36 min) | GPS taken {m} min from the interview start / identical to interview {otherKey}. |

### 3.10 Mode-specific and process (DQ-MD)

| ID | Name | Sev | Modes | Scope | Logic | Rationale | Message |
|---|---|---|---|---|---|---|---|
| DQ-MD-01 | Web mode claimed but keyed by an interviewer | major | W | `interview_mode == 3` | no action 19 (`InterviewSwitchedToCawiMode`) for the interview, or more than 20% of ANS events have role 1 | Web mode is off on all 9,994 assignments, so a genuine self-interview is not possible today | Marked as Web self-interview but answers were keyed under an interviewer login. |
| DQ-MD-02 | Mode changed during the interview | minor | CPW | ALL | `nModeSets > 1` and first value ≠ last value | Switching mode toggles module 0 and GPS. Observed 5 with repeated sets, 1 of them ending on a different mode (CAPI → CATI) | Mode changed from {first} to {last}. |
| DQ-MD-03 | Non-contact closed with too few attempts | major | C | `disp in NON_CONTACT` and `status in {120, 130}` | `nCompleted < 6` | Manual: 6 attempts before non-contact. Attempts are not recorded, so the number of Completed events is the proxy. Observed: 1 approved after one attempt | Approved as non-contact after {nCompleted} recorded attempt(s); 6 required. |
| DQ-MD-04 | Burst of call attempts | major | C | `disp` in NON_CONTACT, PENDING or REFUSED, same interviewer | 5 or more such interviews with `datetime` inside any 15-minute window | Observed: GAES35 logged 15 non-interviews between 20:51 and 21:11 on 13 Nov, each 0.7–2.9 min; all 15 were rejected by the supervisor | {n} call outcomes logged in {m} minutes. |
| DQ-MD-05 | Refusal or non-contact without a comment | minor | C | `disp` in REFUSED or UNREACHABLE and `status >= 100` | no row in `interview__comments` for the interview with role 1 | Manual: record the reason and every number tried | No comment explains this {disp}. |

Supervisor and HQ process checks (category Process, DQ-PR), scope ALL, all modes:

| ID | Name | Sev | Scope | Logic | Rationale | Message |
|---|---|---|---|---|---|---|
| DQ-PR-01 | Late submission | minor | has `completedAt` | `receivedAt - completedAt > 24 h`, or no `receivedAt` and `now - completedAt > 24 h` | Submit by end of day. Observed lag median 2.4 h, max 13.9 h | Reached the server {h} h after completion. |
| DQ-PR-02 | Waiting for supervisor too long | minor | `status == 100` | `now - last Completed action > 48 h` | Daily review rule. Observed decision lag median 18 h, max 29 h | Waiting {h} h for supervisor review. |
| DQ-PR-03 | Returned interview not resubmitted | minor | `status in {65, 125}` | `now - last rejection > 48 h` | 19 + 3 currently returned | Returned {h} h ago and not resubmitted. |
| DQ-PR-04 | Approved without review evidence | major | `status in {120, 130}` and COMPLETE | any of `m1qend…m6qend, m7q01` missing, or `supOpenMin < 2` | Observed: 1 approved with a blank review question; shortest supervisor opening 1.0 min | Approved after {supOpenMin} min of review / with blank review questions. |
| DQ-PR-05 | Approved with unresolved critical flags | major | `status in {120, 130}` | interview has at least one critical flag from any other check | Supervisor approval must not hide a critical problem | Approved while {n} critical flag(s) are open. |
| DQ-PR-06 | Repeatedly rejected | minor | ALL | `rejections__sup + rejections__hq >= 2` | Interviewer not fixing the issue | Rejected {n} times. |
| DQ-PR-07 | Supervisor device clock offset | info | paradata | any event of the user has `tz_offset != "00:00:00"` | Ghana is UTC+0. Observed: 67 events by GAES05 at +01:00 | Device of {user} is set to UTC{offset}. |

### 3.11 Interviewer behaviour (DQ-IB) — one flag per interviewer, not per interview

Compute for interviewers with at least `MIN_N = 5` complete interviews; below that show "insufficient data". "All" = all interviewers pooled.

| ID | Indicator | Sev | Logic | Rationale / observed | Message |
|---|---|---|---|---|---|
| DQ-IB-01 | Short average duration | major | `median(duration)` of the interviewer `< 0.6 * median(duration)` of all | Pooled median 34.9 min, so the line is about 21 min | Median interview {x} min against {all} min overall. |
| DQ-IB-02 | Heaping of money values | minor | interviewer has at least 30 non-zero money values and share that are multiples of 1,000 `> 0.80` | Pooled: 53% multiples of 1,000, 89% multiples of 100. Interviewer range 0.25–0.88 | {pct}% of money values are round thousands (overall {all}%). |
| DQ-IB-03 | High share of interviews with a critical flag | major | `share(critical) > 0.20` | | {pct}% of interviews carry a critical flag. |
| DQ-IB-04 | High rejection rate | minor | `(sum rejections__sup + rejections__hq) / interviews submitted > 0.30`, with at least 5 submitted | GAES35: 15 of 15 | {pct}% of submitted interviews were rejected. |
| DQ-IB-05 | Zero-filling | major | `mean(zeroShare) > pooled mean + 0.15`, or share of interviews with DQ-CP-04 `> 0.20` | Pooled mean about 0.72 | Average {pct}% of money items are zero (overall {all}%). |
| DQ-IB-06 | Low yield | minor | attempted ≥ 10 and `COMPLETE / attempted < 0.5 * pooled rate` | Team 1 (Greater Accra): 20 attempts, 0 completes | {c} completes from {a} attempts. |
| DQ-IB-07 | Unusual non-contact or refusal share | minor | attempted ≥ 10 and (`refused / contacted > 2 * pooled` or `nonContact / attempted > 2 * pooled`) | | Refusal/non-contact share {pct}% against {all}% overall. |
| DQ-IB-08 | Near-identical interviews | critical | two complete interviews by the same interviewer whose 47 FIN_ITEMS are equal on at least 40 positions **and** `zeroShare < 0.8` for both | Copy-paste fabrication | Interviews {k1} and {k2} have {n}/47 identical money values. |
| DQ-IB-09 | No activity | info | interviewer has received assignments and has no interview with `datetime` in the last 2 working days | 52 of 74 interviewers have no interview yet; GAES42 and GAES69 have not synced their assignments to a tablet | No interviews since {date}. |

Also display per interviewer (no flag): interviews by disposition, completes per working day, mean and median duration, `medGapSec`, mean `nChanges`, mean `nAfterEnd`, number of comments written, share of interviews outside calling hours, mean score.

### 3.12 Validation already in the questionnaire (do not present these as dashboard discoveries)

Severity 0 = error, 1 = warning. Errors mark the answer invalid but **do not block completion**; `has__errors` and `entities__errors` are 0 on all 96 interviews, so interviewers are clearing them.

| Variable | Built-in rule | Dashboard action |
|---|---|---|
| `m0q05a` ≤ 12, `m0q06a` < 60 | error | none |
| `m0q08` accuracy ≤ 5 m (error); within 40 m of `id13` (warning) | | recomputed as DQ-GP-04, DQ-GP-05 |
| `m0q00d` valid email | error | none |
| `m1q02` 1800–2026; `m1q04`, `m1q13` 1900–2025 | error | DQ-AR-08, DQ-CN-13 |
| `m1q06a/b/c` 0–100 and sum = 100 (`ownership_total`) | error | DQ-AR-01 (critical, recompute) |
| `m1q17`, `m2q04a`, `m3q06`, `m3q07a`, `m4q04`, `m4q05`, `m5q04`, `m5q05` 0–100 | error | DQ-AR-08 |
| `m3q02a`, `m3q02b`, `m3q09b` ≤ `m3q02` | error | DQ-AR-04 |
| occupation sum and contract sum = `m3q02` (`m3err1`, `m3err2`) | error | DQ-AR-02, DQ-AR-03 |
| `m4q01y == m4t8`, `m5q01j == m5tt`, `m6q01_total == m6t1`, `m6q02_total == m6t2` | error | DQ-AR-05 to DQ-AR-07 |

Not built in, although the manual says the application warns about them: wage per worker, expenses against revenue, electricity against grid, trade purchases against trade revenue. These are the dashboard's main added value (DQ-CN).

Enablement conditions (needed for item non-response): `m0q02a` if `m0q01a==1`; `m0q03a` if `m0q02a==2`; `m0q04a–07a` if `m0q02a==3`; `m0q08` if mode 2; `m0q00d` if `m0q00c==1`; `m0q09b/10b/12b/13b/14b` if the matching `a==1`; `m0q16b/c` if `m0q16a==1`; `m1q01` if `m1q01a==1`; `m1q04` if `m1q03==1`; `m1q07_oth` if `m1q07==96`; `m1q10`, `m1q11` if `m1q09==1`; `m1q13` if `m1q12==1`; `m1q14a` if `m1q14 in {2,3,4}`; `m2q01a–e` if `m2q00==2`; `m2q02a–e` if `m2q02==1`; `m2q04b` if `m2q04a<100`; `m3q07b` if `m3q07a>0`; `m3q08b` if `m3q08a==1`; `m3q09b` if `m3q09a==1`; `m4q04`, `m4q05` if `m4q03==1`; `m5q04`, `m5q05` if `m5q03==1`; `m6q03b/c/d` if `m6q03a==1`; `m6q05_oth` if `m6q03c__96==1`; `m7q02` if `m7q01==2`.

### 3.13 What to purge, exclude or flag for analysis

| Item | Rule | Treatment |
|---|---|---|
| Deleted interviews | `status == -1` | drop everywhere |
| Test, training, pre-fieldwork | DQ-ID-05 or DQ-ID-06 | drop from every page except a "Excluded records" table on Data Quality |
| Non-interviews | `disp != COMPLETE` | keep for Fieldwork Progress and response rates; exclude from Statistical outputs and from the quality score |
| Duplicates | DQ-DU-01, DQ-DU-02 | keep the one with the highest status, then the latest `endtime`; mark the rest `excluded_duplicate` |
| Open critical flags | any critical | exclude from Statistical outputs until resolved (toggle "include unresolved", default off) |
| Returned interviews | `status in {65, 125}` | exclude from Statistical outputs (being corrected) |
| `m4t2`, `m4t8`, `m4q01y` | instrument adds both stock values | never publish; use `opex`, `capex` |
| `timespent` | wall-clock, resettable | never use as duration; show only inside DQ-TM-10 |
| `ownership_total`, `m3err1`, `m3err2`, `gpsAccuracy` | helper variables | drop from the clean CSV |
| `id13__Accuracy`, `id13__Altitude`, `id13__Timestamp` | constant placeholders | drop |
| `m0q08__*`, `gpsAccuracy` | CAPI only | blank for CATI and Web by design; never count as missing there |
| Module 0 (`m0q01a`–`m0q07a`) | CATI only | blank for CAPI and Web by design |
| `m1qend`…`m6qend`, `m7q01`, `m7q02` | supervisor process fields | drop from the analysis CSV; keep for process checks |
| `m0q03a`, `m0q03a_oth`, `m5q04`, `m5q05`, `m1q13`, `m1q07_oth`, `m6q05_oth` | 0 answers so far | hide from item non-response tables until n ≥ 1 |
| `m0q15` postal address | 30 of 70 are placeholders ("0000000", "null", "none", "00") | treat as missing when it matches `^(0+|null|none|no|nil|n/?a|not available|-+)$` (case-insensitive); never flag |
| Personal data: `m0q00a`, `m0q00b`, `m0q00d`, `id02`, `m0q10b`, `id11c`, `m1q01` | respondent and officer identifiers | viewers never see them; the clean CSV download omits them unless the user is admin |
| Money values when `m1q09 == 2` | estimates | keep, with `fin_source = "estimate"`; Statistical outputs offers a "records kept only" filter |

### 3.14 Per-interview quality score (0–100)

Computed for COMPLETE interviews only (`null` otherwise).

```
W = { critical: 25, major: 8, minor: 2, info: 0 }
CAP = { Identification: 50, Duplication: 50, Completeness: 30, Timing: 30, Arithmetic: 50,
        Consistency: 30, "Range-Outlier": 16, GPS: 30, "Mode-specific": 16, Process: 10 }
penalty = sum over categories of min(CAP[cat], sum of W[sev] for the interview's flags in cat)
score = max(0, 100 - penalty)
if the interview has any critical flag: score = min(score, 59)
band: score >= 85 "Good" · 70–84 "Review" · 50–69 "Poor" · < 50 or any critical "Reject"
```

Rules: a check contributes once per interview; RO checks with both levels contribute the higher one; DQ-IB flags (interviewer-level) do not enter the interview score; Process flags about the supervisor (PR-02, PR-04, PR-05) do not penalise the interview — record them with weight 0 and count them on the supervisor's row instead. The caps stop one noisy module (20 consistency minors) from sinking an otherwise sound interview while still letting any single critical pull it under 60.

### 3.15 Interviewer quality index (0–100)

For interviewers with at least 5 complete interviews:

```
S  = mean(score) over the interviewer's complete interviews                      # 0..100
C  = 100 * (1 - share of complete interviews with a critical flag)
T  = 100 * clamp(median(duration) / pooledMedianDuration, 0, 1)                  # only penalises being fast
R  = 100 * (1 - min(1, rejections / submitted))
H  = 100 * (1 - clamp((heapShare_i - pooledHeapShare) / (1 - pooledHeapShare), 0, 1))
Z  = 100 * (1 - clamp((meanZeroShare_i - pooledMeanZeroShare) / (1 - pooledMeanZeroShare), 0, 1))
IQI = 0.40*S + 0.15*C + 0.15*T + 0.10*R + 0.10*H + 0.10*Z
band: >= 85 green · 70–84 amber · < 70 red
```

Show `n` beside every IQI. For 5 ≤ n < 15 render the value in a lighter weight with the note "few interviews". Productivity (completes per working day against 4.1) is shown beside the IQI and is deliberately **not** part of it, so that speed is never rewarded as quality.

---

## 4. Dashboard information architecture

Global elements on every page: left sidebar (navigation), top bar with **data freshness** ("Data as of 15 Nov 2026 01:00 · refresh"), global filters, user menu. Global filters: date range (on `date(datetime)`), region, team, interviewer, mode, disposition, pipeline stage. A supervisor or a region-restricted user sees the filters pre-set and locked to their team or regions. Every chart has a one-line plain-language title that states the takeaway ("Team 5 has completed the most interviews"), a "view data" toggle and a CSV export. Every count is clickable and opens the interview list filtered to it.

### 4.1 Overview (`/`)

Purpose: someone who has never seen the survey understands in ten seconds what it is, where it stands, what needs attention and where to click next.

1. **Hero band** (dark GSS ink): title "Ghana Annual Economic Survey 2026", one sentence ("Ghana's first annual survey of about 10,000 business establishments, collected by telephone, Nov–Dec 2026, for fiscal year 2025"), a **progress ring** (completed interviews / 9,994) with the big number in the middle, and beside it three figures: "Day {d} of 33 working days", "Needed per day from now: {(target − complete) / working days left}", "Completed yesterday: {n}".
2. **KPI tiles with sparklines** (daily series): Completed interviews · Attempted establishments · Cooperation rate · Approved by supervisor · Approved by HQ · Median interview length (min) · Interviews with a critical flag · Active interviewers today (of 74). Each tile: value, change against the previous working day, and a one-line definition on hover.
3. **Timeline bar**: 13 Nov → 31 Dec, a marker for today, shaded elapsed share, and above it the share of target completed, so "time used" and "work done" can be compared at a glance. Text verdict: "On track" if complete ≥ 95% of the expected linear pace, "Behind by {n} interviews" otherwise.
4. **Needs attention** (ranked list, at most 6 rows, each a link): open critical flags; interviews returned and waiting more than 48 h; interviews waiting for supervisor review more than 48 h; teams or regions with attempts but few completes (today: Greater Accra, 21 attempted, 1 complete); interviewers flagged by DQ-IB; interviewers with no activity.
5. **Regional map** (choropleth of the 16 regions, completion % once region targets are loaded, otherwise completed count) next to a **ranked horizontal bar** of the same measure. The bar is the primary reading; the map is the orientation aid.
6. **Pipeline strip**: In progress → Awaiting supervisor → Awaiting HQ → Approved by HQ, with Returned shown as a side branch. Counts today: 1 · 65 · 8 · 0, returned 22.
7. **Where to start** cards: Fieldwork progress · Data quality · Interviewers · Statistical outputs, each with one live number.

### 4.2 Fieldwork Progress (`/progress`)

| Element | Type | Fields | Why |
|---|---|---|---|
| KPIs | tiles | target, attempted, complete, partial, non-contact, refused, pending, completion %, contact rate, cooperation rate | the response picture in one row |
| Daily trend | columns (completes per day) with a line for cumulative completes and a dashed line for the required cumulative pace | `date(endtime)` for completes; pace = 303 per working day | are we keeping up |
| Outcome of attempts | one stacked horizontal bar, 100% | `disp` groups | where attempts are lost |
| By region | sortable table with an inline bar: target, attempted, complete, %, non-contact, refused, median duration, flags | `id04b` | regional gaps |
| By district | table under an expanded region | `id05b` | drill-down |
| By team | grouped bars: complete against target, one pair per team | `id10` | supervisor accountability |
| Mode split | 100% stacked bar per team (CATI, CAPI, Web) plus counts | `interview_mode` | CAPI is on request only |
| Status pipeline | horizontal funnel with the rejection loop drawn as a return arrow: Completed → Approved by supervisor → Approved by HQ; rejected by supervisor; rejected by HQ; resubmitted | `interview__status`, actions 3, 5, 6, 7, 8 | where work is stuck |
| Review lags | two tiles + histogram: completion → supervisor decision, supervisor approval → HQ decision (hours) | actions | review speed |
| Call-backs due | table | `disp == CALLBACK`, `m0q04a`, `m0q05a`–`m0q07a` | appointments to keep |
| Sector coverage | bar by ISIC section, complete (and target when loaded) | `section` | sector balance |

### 4.3 Data Quality (`/quality`)

| Element | Type | Fields | Why |
|---|---|---|---|
| KPIs | tiles | mean score, % Good / Review / Poor / Reject, interviews with critical flags, open flags, flags per interview | headline |
| Score distribution | histogram, 10-point bins, coloured by band | `score` | spread, not just the mean |
| Flags by category and severity | stacked horizontal bar | `category`, `severity` | where the problems are |
| Check table | table: id, name, category, severity, interviews flagged, % of eligible, trend against 7 days ago; click a row to open its interviews | flag records | which rules fire |
| Flagged interviews | table: key, establishment (name only for supervisor and admin), interviewer, team, region, mode, score, band, n critical/major/minor, status; expandable row lists every flag message and values, plus a link `https://survey.statsghana.gov.gh/gaes/Interview/Review/{interview__id}` | flags | the work list |
| Interviewer leaderboard | table sorted by IQI ascending (worst first), with components | 3.15 | who needs coaching |
| Item non-response | table by variable: enabled n, missing %, zero % | 3.4 | weak questions |
| Excluded records | table | 3.13 | transparency |

Flag CSV and a per-team "error report" (PDF or CSV grouped by interviewer) reproduce the manual's daily DQM error report.

### 4.4 Timing (`/timing`)

| Element | Type | Fields | Why |
|---|---|---|---|
| KPIs | tiles | median active minutes, % under 15 min, % over 120 min, % outside 07:00–19:00, median answers gap | headline |
| Duration distribution | histogram of `activeMin` with reference lines at 10, 15, 30 and 120 | | short and long tails |
| Duration by interviewer | box plot (or dot strip for n < 10), ordered by median, pooled median as a line | | who is fast |
| Start hour by weekday | heat map, hour × weekday, count of starts | `datetime` | calling-hours compliance |
| Recorded against active time | scatter `timespent` (log axis) against `activeMin` | | shows resets and interruptions |
| Module time | bar of median minutes per module (gap sums by variable prefix `m1`–`m6`) | paradata | where interviews spend time |
| Day timeline for one interviewer | Gantt of sessions (Resumed→Paused), one row per interview, pick interviewer and date | paradata | overlaps and bursts at a glance |
| Timing flags | table of DQ-TM flags | | work list |

### 4.5 Statistical outputs (`/outputs`)

A fixed banner on the page: **"Unweighted, preliminary. Based on {n} completed interviews that passed critical checks. Not for publication."** Suppress any cell with fewer than 5 establishments (show "–").

| Element | Type | Fields |
|---|---|---|
| KPIs | tiles: establishments, total workers 2025, median workers, median revenue, total revenue, median wage per paid employee | `emp25`, `rev`, `wpw` |
| Establishments by ISIC section | horizontal bar, sorted | `section` |
| Employment size class | bar: 0, Micro, Small, Medium, Large | `sizeClass` |
| Workers | stacked bar by contract type (permanent, temporary, unpaid) and by occupation; female share; SSNIT share | `m3q05*`, `m3q04*`, `m3q02a`, `m3q02b` |
| Revenue | table by region and by section: n, median, mean, p25, p75, total; log-scale box plot by section | `rev` |
| Costs | stacked bar of `opex` composition (labour, trade goods, operating, services, financial, taxes) | `m4t1`, `m4q01f`, `m4t3`–`m4t6` |
| Investment and balance sheet | tiles and table: capex, assets, liabilities, share with any liability | `capex`, `assets`, `liab` |
| Characteristics | small bars: legal form, registered, keeps records, operational status, female-owned (≥ 50%), revenue change, capacity utilisation (median), applied for credit, source of credit | `m1q07`, `m1q03`, `m1q09`, `m1q14`, `m1q17`, `m5q02`, `m2q04a`, `m6q03a`, `m6q03c__*` |

Filters: region, section, size class, mode, "records kept only", "include unresolved".

### 4.6 Interviewers and Teams (`/interviewers`)

Team cards (supervisor, interviewers active / total, complete / target, mean score, awaiting review, median review lag) and an interviewer table: ID, name, team, assignments, attempted, complete, completes per working day, cooperation rate, median duration, mean score, IQI with n, rejections, DQ-IB flags, last activity. An interviewer detail page shows their daily completes, duration box, flag list, the session Gantt and their comments. A supervisor table shows interviews reviewed, median decision lag, rejection rate, median opening time and PR-04/PR-05 counts.

### 4.7 Data (`/data`)

* **Refresh from Survey Solutions** (admin and supervisor): starts a tabular export and a paradata export through the export API, shows job progress, then re-runs the checks. Show the time and row count of the last successful refresh and keep the previous snapshot until the new one validates (non-empty, expected columns).
* Downloads: **cleaned CSV** (one row per interview with the derived variables of 2.7, `disp`, `score`, `band`, exclusion reason; identifiers removed for non-admins), **flags CSV** (one row per flag), **interviewer summary CSV**, **targets JSON**, raw export zip (admin only).
* A data dictionary table for the cleaned CSV.

### 4.8 Users (`/admin/users`, admin only)

Users are stored in a JSON file: `{ id, username, name, passwordHash, role, regions: number[] | null, team: number | null, active, createdAt, lastLoginAt }`. Roles: **admin** (everything, user management, raw download), **supervisor** (all pages, refresh, identifiers visible, restricted to their team or regions if set), **viewer** (read-only, no identifiers, no raw download). The region or team restriction is applied on the server to every query and download, not only in the UI. Passwords are stored hashed; the first admin comes from environment variables.

---

## 5. Visual design system

### 5.1 Colour tokens (hex values read from the two reference sites' CSS)

Brand (Ghana in Numbers, `ghin.statsghana.gov.gh`; the Disability dashboard uses the same family: `#392675`, `#352676`, `#4c3acb`, `#6b4bff`, `#f4f3fb`, `#f8f6ff`, `#efeaff`):

| Token | Hex | Use |
|---|---|---|
| `--gss-ink-deep` | `#1a1343` | hero gradient end, footer |
| `--gss-ink` | `#241b5a` | sidebar, hero band, theme colour |
| `--gss-purple` | `#3c2fa3` | primary: buttons, links, active state, first chart series, focus ring |
| `--gss-purple-hover` | `#31268c` | hover |
| `--gss-purple-soft` | `#eeecfa` | selected row, soft chips |
| `--gss-purple-line` | `#d6d2f2` | borders on soft purple |
| `--gss-gold` | `#f5c451` | accent on dark backgrounds (hero numbers, ring track highlight) |
| flag stripe | `#ce1126`, `#fcd116`, `#006b3f` | a thin three-colour stripe under the header only; never as data colours |

Neutrals: canvas `#f4f5f9` · surface `#ffffff` · surface-muted `#f8f9fc` · line `#e3e6ee` · line-strong `#cbd1dd` · ink `#0f172b` · body `#334155` · muted `#4b5a70` · subtle `#5a697f` · chart grid `#e8ebf2` · chart axis `#64748b`.

Semantic: good `#0f7a55` (soft `#e6f4ee`, derived) · bad `#b43c2a` (soft `#fbeae7`, derived) · warn ink `#8a5300`, warn background `#fff7e6`, warn border `#f3d9a4` · warn fill for charts `#d17a22` · info `#2f6db5`.
Severity: critical = bad, major = `#d17a22`, minor = `#c9a227` (derived from the gold), info = `#6b7a90`. Always pair colour with an icon or label.
Score bands: Good `#0f7a55` · Review `#c9a227` · Poor `#d17a22` · Reject `#b43c2a`.

Categorical chart palette (first six are the site's `--chart-1..6`; the last two are derived and must be checked for contrast and colour-blind separation before use):

1. `#3c2fa3` purple 2. `#0e8a7e` teal 3. `#d17a22` orange 4. `#2f6db5` blue 5. `#b4436c` rose 6. `#6b7a90` slate 7. `#c9a227` gold (derived) 8. `#7a5a3a` brown (derived)

Fixed assignments so colours mean the same thing on every page: CATI purple, CAPI teal, Web orange; Complete purple, Partial blue, Non-contact slate, Refused rose, Pending gold. Use at most six series in one chart; beyond that, group into "Other".

Sequential palette (choropleth and heat maps, light to dark; all but the third step are site colours): `#eeecfa`, `#d6d2f2`, `#a59be3` (derived), `#5040c9`, `#3c2fa3`, `#2c2270`, `#1a1343`. No data: `#e3e6ee` with a hatch.

### 5.2 Type, layout, components

* Font: **Inter** (the site loads it through `next/font`), fallback `"Segoe UI", "Helvetica Neue", Arial, sans-serif`. Tabular numerals for every figure. Sizes: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 px; KPI values 30–36 px semibold with tight tracking; hero number 56–64 px.
* Layout as on Ghana in Numbers: fixed dark sidebar 272 px (`--gss-ink`, white text at 85% opacity, active item is a white pill with purple icon), content on the `#f4f5f9` canvas, maximum content width about 1,280 px, 24 px gutters; sidebar collapses to a drawer under 1,024 px.
* Cards: white, 1 px `#e3e6ee` border, radius 12 px (16 px for hero and large panels), shadow `0 1px 2px #0f172b0a, 0 1px 3px #0f172b0a`; popovers `0 12px 32px #0f172b29, 0 2px 6px #0f172b14`. Card header: 14 px semibold title, 12 px muted subtitle, actions on the right.
* Branding: GSS logo in a white circle (44 px, 1 px white ring) at the top of the sidebar with "GAES 2026 Dashboard" and "Ghana Statistical Service" beneath, exactly as the reference site does. Logo sources: `https://ghin.statsghana.gov.gh/logo.svg` (SVG, 2286 × 2258) and `https://disabilitydashboard.netlify.app/gss-logo.png`. Copy one into `/public`; do not hot-link.
* Tables: 14 px, sticky header on `#f8f9fc`, row height 44 px, numeric columns right-aligned, inline bars in `#3c2fa3` on `#eeecfa`.
* Charts: horizontal bars for rankings, columns and lines for time, one stacked bar for parts of a whole (no pies, no dual axes except the daily trend's cumulative line, which shares the unit). Direct labels over legends where there are four series or fewer. Grid `#e8ebf2`, axis text `#64748b` 12 px. Every chart has a text summary for screen readers.
* States: skeleton loaders, "No data for these filters" empty state, and a visible banner when the last refresh failed.

### 5.3 "Wow" elements that stay readable

1. **Hero band** on the Overview: gradient `#241b5a → #1a1343`, the completed count in gold `#f5c451`, counting up once on load (600–800 ms; disabled under `prefers-reduced-motion`).
2. **Progress ring** against the 9,994 target, with a thin outer arc for the share of fieldwork time elapsed, so being ahead or behind is visible without reading a number.
3. **Sparkline KPI tiles**: 14-day mini series, last point dotted, change chip coloured by direction and by whether up is good for that metric.
4. **Ghana regional choropleth**: GeoJSON of the 16 regions from geoBoundaries (verified: 16 features, `shapeName` such as "Greater Accra Region", `shapeISO` such as `GH-AA`, 270 KB simplified): `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GHA/ADM1/geoBoundaries-GHA-ADM1_simplified.geojson` (API record: `https://www.geoboundaries.org/api/current/gbOpen/GHA/ADM1/`; licence CC BY-SA 2.0, OpenStreetMap; add the attribution). Join on name: upper-case `shapeName` minus " Region" equals `id04a`. Hover shows the region's numbers; click filters the page.
5. **Pipeline flow** with the rejection loop drawn as a curved return arrow carrying its count.
6. **Interviewer day timeline** (session Gantt), the most direct way to see bursts and overlaps.

---

## 6. Open questions and assumptions

1. **Region and sector targets are not documented.** The spec assumes they can be rebuilt from the assignments API's identifying data. If the API user cannot read assignments, GSS must supply the sample file (`id01a`, region, district, ISIC, size stratum, interviewer).
2. **Fieldwork end date and working days**: assumed 31 Dec 2026 and 33 working days (4 and 25 Dec removed). Confirm, including whether Saturday work (37 completes on 14 Nov) is sanctioned; if so, the pace calculation should count Saturdays.
3. **Minimum wage**: assumed GHS 19.97 a day for 2025, giving about GHS 6,470 a year. Confirm the figure and the 27-day convention.
4. **Expense totals**: is adding the opening and closing stock to block II (`m4t2`) intended? The manual says no, and also expects a "purchases of raw materials" item that is missing. Until fixed, total expenses cannot be estimated properly and value added cannot be computed.
5. **Call attempts are not recorded.** The six-attempt rule is checked through the number of Completed events, which is only a proxy. Is the intended workflow that a supervisor rejects a non-contact so the interviewer can call again (as with GAES35's 15 cases)? A call-attempt roster in the questionnaire would make this measurable.
6. **Disposition** is derived (2.4) because there is no result code or consent item. One observed case is coded "refused" while the comment says the establishment did not operate in 2025; an "out of scope / not operating" outcome is missing from `m0q02a`.
7. **Web mode**: allowed by the questionnaire but disabled on all assignments, and no Web interview exists. Web thresholds (DQ-TM-04, DQ-MD-01) are provisional.
8. **CAPI**: who authorises it? The dashboard only reports the share; three of the five CAPI interviews are by one interviewer (GAES70).
9. **Size classes** follow the IBES convention (1–5, 6–30, 31–100, 101+). Confirm.
10. **Outlier grouping** by ISIC section needs at least 20 cases per section; until then the pooled distribution is used, which will over-flag large firms in capital-intensive sectors.
11. **Timing thresholds** come from 70 interviews in the first two days and should be re-estimated after about 500 completes (keep them in config).
12. **Manual and instrument differ**: the manual documents modules 7–9, hires and separations, and application warnings (wage per worker, expenses against revenue) that the deployed questionnaire does not contain. The dashboard follows the instrument.
13. **Questionnaire version**: assumed `…$1`. If a new version is imported mid-fieldwork, the refresh must export and append every version.
14. **Two derived palette colours** (gold `#c9a227`, brown `#7a5a3a`) and the soft semantic backgrounds are not from the reference sites; they need a contrast and colour-blind check.
15. **Personal data**: the spec hides respondent names, phones, emails and TINs from viewers. Confirm that supervisors may see them.
16. **Process flags**: DQ-PR-02, PR-04 and PR-05 describe the supervisor's work, so they carry no interview penalty (3.14). Confirm that this is the wanted behaviour.


## Addendum (15 Nov 2026): questionnaire versions and call attempts

- **Versions are merged.** Every version of `gaes_data` in the workspace is exported and stacked into one dataset (`qversion` on each row). Columns are the union across versions; a question a version did not ask is blank for its interviews and is left out of that version's item non-response. A new version is picked up automatically at the next export.
- **Re-attempts after an upgrade.** An unfinished v1 record and a fresh attempt at the same establishment in a newer version are not duplicates: the completed (or newest) one is kept and the older one is set aside as "Earlier attempt". DQ-DU-01 fires only for two completed interviews of one establishment, or two records in the same version.
- **Call attempts (`m6q04`, from v2).** "How many times did you call the firm before successful completion". For interviews without the question, the number is read from the comment thread (supervisor's comment first), e.g. "call attempt was 2". Vague wording ("more than 5 times") is ignored. Reported for completed interviews only; valid range 1–20.
- **DQ-CP-09** (minor): completed v2+ interview with `m6q04` blank, zero or above 20.
