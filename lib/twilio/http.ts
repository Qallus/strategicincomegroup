import { NextResponse } from "next/server";

/**
 * JSON error with a status that matches what went wrong: missing session → 401, wrong role →
 * 403, otherwise `fallbackStatus` (500 by default; 400 for routes whose errors are validation).
 */
export function commsError(error: unknown, fallback: string, fallbackStatus = 500) {
  const message = error instanceof Error ? error.message : fallback;
  let status = fallbackStatus;
  if (/authentication required|auth is not configured/i.test(message)) status = 401;
  else if (/(permission|profile) required/i.test(message)) status = 403;
  return NextResponse.json({ error: message }, { status });
}
