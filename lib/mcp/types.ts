// Shared shapes and small helpers for the SIG MCP tool modules.
import type { Preview } from "./actions";
import type { McpCaller } from "./auth";
import { canUseArea, type Area } from "./policy";
import type { Risk } from "./safety";

export type Json = Record<string, unknown>;

export type ToolOutput = {
  result: unknown;
  /** For the audit row: a one-line summary, which record, and before/after. */
  summary?: string | null;
  entity?: string | null;
  recordId?: string | null;
  before?: unknown;
  after?: unknown;
  /** Set by sig_confirm: the pending action it ran. */
  confirmationId?: string | null;
  executedTool?: string;
};

export type McpTool = {
  name: string;
  title: string;
  description: string;
  risk: Risk;
  /** The RBAC area the caller's role must reach (lib/mcp/policy.ts). Omit for meta tools. */
  area?: Area;
  /** Reaches outside SIG (public site, emails). */
  openWorld?: boolean;
  inputSchema: Json;
  /** Extra availability check on top of `area`. */
  available?: (caller: McpCaller) => boolean;
  /**
   * write tools only: return a preview when THIS call needs the person's
   * go-ahead after all (e.g. editing something already live). The call is then
   * held like a high-risk one and sig_confirm runs `run` with the stored args.
   */
  escalate?: (args: Json, caller: McpCaller) => Promise<Preview | null>;
  /** read and write tools. */
  run?: (args: Json, caller: McpCaller) => Promise<ToolOutput>;
  /** high tools: say exactly what would happen, change nothing (throw to refuse). */
  preview?: (args: Json, caller: McpCaller) => Promise<Preview>;
  /** high tools: do it, with the arguments stored at preview time. */
  execute?: (args: Json, caller: McpCaller) => Promise<ToolOutput>;
};

export function toolVisible(tool: McpTool, caller: McpCaller): boolean {
  if (!caller.allowedTiers.includes(tool.risk)) return false;
  if (tool.area && !canUseArea(caller.profile.role, tool.area)) return false;
  if (tool.available && !tool.available(caller)) return false;
  return true;
}

// ── JSON Schema helpers ──────────────────────────────────────────────────────
export const obj = (properties: Json = {}, required: string[] = []): Json => ({ type: "object", properties, required });
export const str = (description: string) => ({ type: "string", description });
export const strEnum = (values: readonly string[], description: string) => ({ type: "string", enum: values, description });
export const int = (description: string, min = 1, max = 100) => ({ type: "integer", description, minimum: min, maximum: max });
export const num = (description: string) => ({ type: "number", description });
export const bool = (description: string) => ({ type: "boolean", description });
export const strArr = (description: string) => ({ type: "array", items: { type: "string" }, description });
export const anyObj = (description: string) => ({ type: "object", description, additionalProperties: true });
export const id = (what: string) => str(`${what} id (uuid)`);

// ── Argument helpers ─────────────────────────────────────────────────────────
export const s = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
export const opt = (v: unknown) => (s(v) ? s(v) : undefined);
export const clamp = (v: unknown, dflt: number, max: number) => Math.min(Math.max(Number(v) || dflt, 1), max);

export function need(args: Json, key: string, label = key): string {
  const v = s(args[key]);
  if (!v) throw new Error(`${label} is required.`);
  return v;
}

/** Copy only the listed keys that were actually provided. */
export function pickDefined(args: Json, keys: readonly string[]): Json {
  const out: Json = {};
  for (const k of keys) if (k in args && args[k] !== undefined) out[k] = args[k];
  return out;
}

/** Escape a user string for use inside a PostgREST .or() ilike filter. */
export function ilikeSafe(term: string): string {
  return term.replace(/[%,()*\\]/g, " ").trim();
}
