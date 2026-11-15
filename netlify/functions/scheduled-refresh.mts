// Netlify Scheduled Function: keeps GAES data fresh even when nobody has the dashboard open.
// Calls the app's /api/cron endpoint every 15 minutes. Requires the CRON_SECRET environment variable.
export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.log("scheduled-refresh skipped: URL or CRON_SECRET not set");
    return new Response("skipped", { status: 200 });
  }
  const res = await fetch(`${base}/api/cron`, { headers: { Authorization: `Bearer ${secret}` } });
  console.log("scheduled-refresh", res.status, (await res.text()).slice(0, 300));
  return new Response("ok", { status: 200 });
};

export const config = { schedule: "*/15 * * * *" };
