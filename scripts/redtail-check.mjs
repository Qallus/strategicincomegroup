#!/usr/bin/env node
// Verify Redtail credentials from .env.local — read-only, writes nothing anywhere.
//
//   npm run redtail:check                    # user-key auth → fetch 1 page of contacts (count + first id only)
//   npm run redtail:check -- --get-user-key  # basic auth (username/password) → print the UserKey to paste
//                                            # into REDTAIL_DEV_USER_KEY / REDTAIL_PROD_USER_KEY
//
// Environment: REDTAIL_ENVIRONMENT=development (default, review host) or production. Prefer the
// dashboard (Credentials → CRM → Test connection), which fetches and saves the UserKey for you.
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const prod = (process.env.REDTAIL_ENVIRONMENT || "").toLowerCase() === "production";
const base = (process.env.REDTAIL_API_BASE_URL_OVERRIDE ||
  (prod ? "https://crm.redtailtechnology.com/api/public/v1" : "https://review.crm.redtailtechnology.com/api/public/v1")).replace(/\/+$/, "");
const apiKey = prod ? process.env.REDTAIL_PROD_API_KEY : process.env.REDTAIL_DEV_API_KEY;
const userKeyVar = prod ? "REDTAIL_PROD_USER_KEY" : "REDTAIL_DEV_USER_KEY";
const userKey = process.env[userKeyVar];
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

async function get(path, auth) {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: auth, Accept: "application/json" } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

async function main() {
  console.log(`Redtail base URL: ${base}`);
  if (!apiKey) throw new Error(`Set ${prod ? "REDTAIL_PROD_API_KEY" : "REDTAIL_DEV_API_KEY"} in .env.local first.`);

  if (process.argv.includes("--get-user-key")) {
    const { REDTAIL_USERNAME: u, REDTAIL_PASSWORD: p } = process.env;
    if (!u || !p) throw new Error("Set REDTAIL_USERNAME and REDTAIL_PASSWORD in .env.local.");
    const r = await get("/authentication", `Basic ${b64(`${apiKey}:${u}:${p}`)}`);
    if (r.status !== 200) throw new Error(`Authentication failed (${r.status}): ${r.text.slice(0, 200)}`);
    const key = r.json?.authenticated_user?.user_key ?? r.json?.user_key;
    console.log(key ? `User key: ${key}\nPaste it into ${userKeyVar}, then blank REDTAIL_PASSWORD.` : `Authenticated, but no user_key field found:\n${r.text.slice(0, 400)}`);
    return;
  }

  if (!userKey) throw new Error(`Set ${userKeyVar} (or run with --get-user-key first).`);
  const r = await get("/contacts?page=1", `Userkeyauth ${b64(`${apiKey}:${userKey}`)}`);
  if (r.status !== 200) throw new Error(`Contacts request failed (${r.status}): ${r.text.slice(0, 200)}`);
  const list = r.json?.contacts ?? r.json?.data ?? [];
  const meta = r.json?.meta ?? {};
  console.log(`✓ Connected. Page 1 returned ${Array.isArray(list) ? list.length : "?"} contacts${meta.total_records ? ` of ${meta.total_records}` : ""}.`);
  if (Array.isArray(list) && list[0]) console.log(`  First contact id: ${list[0].id} (no personal data printed)`);
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
