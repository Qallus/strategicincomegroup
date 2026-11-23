// Rebuilds the SIG Analytics daily rollups. Run by Coolify scheduled tasks inside the
// app container:
//   node scripts/analytics-cron.mjs intraday   (every 15 minutes: today's rollup)
//   node scripts/analytics-cron.mjs nightly    (02:00 Arizona: yesterday + today, 13-month purge)
// Authenticates with the shared CRON_SECRET (set once on the app).
const port = process.env.PORT || 3000;
const secret = process.env.CRON_SECRET;
const mode = process.argv[2] === "nightly" ? "nightly" : "intraday";

if (!secret) {
  console.error("[analytics-cron] CRON_SECRET is not set in the container env.");
  process.exit(1);
}

try {
  const res = await fetch(`http://127.0.0.1:${port}/api/admin/analytics/sync?mode=${mode}`, {
    method: "POST",
    headers: { "x-cron-secret": secret, "content-type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const text = await res.text();
  console.log(`[analytics-cron] ${mode} ${res.status} ${text}`);
  if (!res.ok) process.exit(1);
} catch (err) {
  console.error("[analytics-cron] request failed:", err);
  process.exit(1);
}
