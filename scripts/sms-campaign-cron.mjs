// Drains the bulk SMS campaign queue: starts scheduled campaigns that are due and keeps
// sending campaigns that are mid-send (throttled; ~50 s of sending per run). Run every
// minute by a Coolify scheduled task inside the app container:
//   node scripts/sms-campaign-cron.mjs
// Authenticates with the shared CRON_SECRET (set once on the app).
const port = process.env.PORT || 3000;
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("[sms-campaign-cron] CRON_SECRET is not set in the container env.");
  process.exit(1);
}

try {
  const res = await fetch(`http://127.0.0.1:${port}/api/admin/sms/campaigns/process`, {
    method: "POST",
    headers: { "x-cron-secret": secret, "content-type": "application/json" },
    body: JSON.stringify({ budgetMs: 50000 }),
    signal: AbortSignal.timeout(70000),
  });
  const text = await res.text();
  console.log(`[sms-campaign-cron] ${res.status} ${text}`);
  if (!res.ok) process.exit(1);
} catch (err) {
  console.error("[sms-campaign-cron] request failed:", err);
  process.exit(1);
}
