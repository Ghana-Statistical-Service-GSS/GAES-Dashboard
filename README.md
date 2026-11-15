# GAES 2026 Dashboard

Fieldwork monitoring, data-quality checks and preliminary statistics for the **Ghana Annual Economic Survey 2026** (Ghana Statistical Service). It reads data live from **Survey Solutions** through the export API, so there is no database and no R/Python step.

- **Overview**: progress against the 9,994-establishment sample, pace, what needs attention, and a regional map
- **Fieldwork progress**: daily trend against the required pace, call outcomes, region/district/team/sector, and the review pipeline
- **Data quality**: 104 automated checks, a 0–100 score per interview, the work list, the interviewer quality index, item non-response, and excluded records
- **Timing & paradata**: active interview time from paradata, fast answering, calling hours, and interviewer day timelines
- **Statistical outputs**: unweighted, preliminary estimates from clean interviews only, with small cells suppressed
- **Interviewers & teams**, **Data & downloads** (cleaned CSV, flags, dictionary, raw zip), **User management**

The full methodology, including every check with its logic, threshold and rationale, is in [`docs/SPEC.md`](docs/SPEC.md). The thresholds themselves are in [`src/lib/data/config.ts`](src/lib/data/config.ts).

---

## 1. Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`, then create the other accounts under **User management**.

## 2. Environment variables

| Variable | Required | Example / notes |
|---|---|---|
| `SUSO_URL` | yes | `https://survey.statsghana.gov.gh` |
| `SUSO_WORKSPACE` | yes | `gaes` |
| `SUSO_USER` | yes | Survey Solutions **API user** |
| `SUSO_PASSWORD` | yes | API user password |
| `SUSO_QUESTIONNAIRE_VARIABLE` | no | `gaes_data`. Every version of this questionnaire is exported and merged |
| `AUTH_SECRET` | yes | Any long random string; it signs the login sessions (`openssl rand -hex 32`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | yes | The always-available system administrator (recovery account) |
| `BLOB_READ_WRITE_TOKEN` | Vercel only | Created automatically when you add a Blob store, and makes `users.json` persistent |
| `GAES_AUTO_EXPORT_MINUTES` | no | Default `30`. When the latest export is older than this, the dashboard asks Survey Solutions for a new one by itself (`0` turns it off) |
| `CRON_SECRET` | recommended | Protects `/api/cron`, the scheduled-refresh endpoint (`openssl rand -hex 24`) |
| `GAES_SKIP_PARADATA` | no | Set to `1` to skip paradata if exports become too large (timing checks then use session time) |

> Never commit `.env` or `.env.local`; both are in `.gitignore`.

## 3. Deploy

### Netlify (simplest; user storage works with no setup)
1. Push this folder to GitHub, then in Netlify choose **Add new site → Import from Git**.
2. Netlify detects Next.js. Build command `npm run build`. Node 22 is set in `netlify.toml`.
3. **Site settings → Environment variables**: add the variables from section 2.
4. Deploy. Users, targets and the processed-data cache are stored as JSON in **Netlify Blobs** automatically.

### Vercel
1. **Add New → Project**, then import the repository. The framework is detected as Next.js.
2. Add the environment variables from section 2.
3. **Storage → Create → Blob** (private) and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`, so `users.json` persists.
   Without a Blob store, Vercel's disk is read-only and user accounts can reset. The User management page warns about this, and you can still **Export users.json** and commit it as `data/users.seed.json`.
4. Deploy.

## 4. How data flows

1. A page asks `/api/data`. The server finds the latest **completed** Tabular and Paradata export jobs for each questionnaire version via the Survey Solutions export API v2.
2. If those jobs were already processed, the cached result is returned instantly (from memory or the JSON store).
3. Otherwise the zips are downloaded, deleted, test and duplicate interviews are set aside, and paradata is summarised. Then all checks, scores, indices, targets and tables are computed.
4. **Refresh data** (supervisors and admins) starts new exports, shows progress, and reprocesses when they finish.
5. Region restrictions and privacy rules are applied **on the server** for each user. Viewers never receive establishment names or phone numbers.

## 4b. Automatic updates — nobody has to press Refresh

| Layer | What it does |
|---|---|
| Server | On every data check (at most once a minute), if the newest export is older than `GAES_AUTO_EXPORT_MINUTES` (30), it requests a fresh Tabular + Paradata export from Survey Solutions in the background. This is rate-limited, so many visitors trigger only one export. |
| Browser | An open dashboard quietly reloads its data every 5 minutes while the tab is visible. Filters and the current view are kept. |
| Schedule | **Netlify:** `netlify/functions/scheduled-refresh.mts` calls `/api/cron` every 15 minutes automatically (set `CRON_SECRET`). Data stays fresh and pre-processed even when nobody is looking. **Vercel:** Hobby plans only allow daily cron jobs, so either rely on the server/browser layers or point a free external scheduler (e.g. cron-job.org) at `https://<your-site>/api/cron?key=<CRON_SECRET>` every 15 minutes. |

Typical freshness while fieldwork is running: **data is at most about 30–35 minutes old**. The **Refresh data** button still forces an immediate export.

## 5. Users and roles (`users.json`, no database)

| Role | Can do |
|---|---|
| **admin** | Everything: create, disable and delete users, set targets, download the raw export zip, and see respondent identifiers |
| **supervisor** | All pages, refresh data, clean downloads (respondent phones and names removed) |
| **viewer** | Read-only dashboard; establishment names, addresses and GPS hidden |

Any user can be restricted to one or more regions. Passwords are stored as salted scrypt hashes. Use **Export users.json** for backups and **Import JSON** to restore.

## 6. Targets

National, team and interviewer targets come from the assignments in Survey Solutions. **Region and sector targets are not in the export**, so an admin enters them on **Data & downloads → Sample targets** (typed in or pasted from Excel). Completion percentages by region and sector then appear across the dashboard.

## 7. Assumptions to confirm (also in `docs/SPEC.md` §6)

- Fieldwork runs 33 days, weekends included: 13 Nov – 15 Dec 2026 (`SURVEY.fieldEnd`, `SURVEY.weekendsAreWorkdays`, `SURVEY.holidays`).
- The 2025 minimum wage is taken as GH₵ 19.97/day, about GH₵ 6,470/year, for the wage-per-worker checks.
- Size classes: Micro 1–5, Small 6–30, Medium 31–100, Large 101+.
- Expense totals: the questionnaire's `m4t2`/`m4q01y` add opening **and** closing stock, so the dashboard uses operating expenses instead and never publishes those totals.

All of these are constants in `src/lib/data/config.ts`.
# GAES-Dashboard
