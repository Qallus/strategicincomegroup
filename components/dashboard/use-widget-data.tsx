"use client";

// Widget data on the client: one shared store, requests batched into a single
// POST /api/dashboard/data per tick, de-duplicated by request id, refreshed on an
// interval while the tab is visible. The server shell seeds the store with first data.

import * as React from "react";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { makeRequest } from "@/lib/dashboard/requests";
import type { WidgetDataRequest, WidgetDataResult } from "@/lib/dashboard/types";

type Entry = { result: WidgetDataResult | null; loading: boolean; updatedAt: number; inflight: boolean };
type Listener = () => void;

class DataStore {
  private entries = new Map<string, Entry>();
  private listeners = new Map<string, Set<Listener>>();
  private queue = new Map<string, WidgetDataRequest>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  token = "";

  constructor(seed: Record<string, WidgetDataResult> = {}) {
    const now = Date.now();
    for (const [id, result] of Object.entries(seed)) this.entries.set(id, { result, loading: false, updatedAt: now, inflight: false });
  }

  get(id: string): Entry | undefined {
    return this.entries.get(id);
  }

  subscribe(id: string, fn: Listener) {
    const set = this.listeners.get(id) ?? new Set();
    set.add(fn);
    this.listeners.set(id, set);
    return () => {
      set.delete(fn);
    };
  }

  private emit(id: string) {
    this.listeners.get(id)?.forEach((fn) => fn());
  }

  private set(id: string, patch: Partial<Entry>) {
    const prev = this.entries.get(id) ?? { result: null, loading: false, updatedAt: 0, inflight: false };
    this.entries.set(id, { ...prev, ...patch });
    this.emit(id);
  }

  /** Queue a fetch. Without `force`, a fresh entry (younger than maxAgeMs) is reused. */
  request(req: WidgetDataRequest, opts: { force?: boolean; maxAgeMs?: number } = {}) {
    const cur = this.entries.get(req.id);
    if (cur?.inflight) return;
    if (!opts.force && cur?.result && Date.now() - cur.updatedAt < (opts.maxAgeMs ?? 30_000)) return;
    this.queue.set(req.id, req);
    this.set(req.id, { loading: !cur?.result, inflight: true });
    if (!this.timer) this.timer = setTimeout(() => void this.flush(), 16);
  }

  /** Replace an entry's data locally (optimistic updates). */
  mutate(id: string, updater: (data: unknown) => unknown) {
    const cur = this.entries.get(id);
    if (!cur?.result || !cur.result.ok) return;
    this.set(id, { result: { ok: true, data: updater(cur.result.data) } });
  }

  private async flush() {
    this.timer = null;
    const batch = [...this.queue.values()];
    this.queue.clear();
    if (!batch.length) return;
    for (let i = 0; i < batch.length; i += 40) {
      const chunk = batch.slice(i, i + 40);
      try {
        const res = await fetch("/api/dashboard/data", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(this.token ? { "x-sig-action-token": this.token } : {}) },
          body: JSON.stringify({ requests: chunk, actionToken: this.token || undefined }),
        });
        const body = (await res.json().catch(() => ({}))) as { results?: Record<string, WidgetDataResult>; error?: string };
        const now = Date.now();
        for (const r of chunk) {
          const result = body.results?.[r.id] ?? { ok: false as const, error: body.error ?? "This card couldn't load.", status: res.status || 500 };
          this.set(r.id, { result, loading: false, inflight: false, updatedAt: now });
        }
      } catch {
        for (const r of chunk) {
          const prev = this.entries.get(r.id);
          this.set(r.id, { loading: false, inflight: false, result: prev?.result ?? { ok: false, error: "You appear to be offline.", status: 0 }, updatedAt: Date.now() });
        }
      }
    }
  }
}

const StoreContext = React.createContext<DataStore | null>(null);

export function DashboardDataProvider({ seed, children }: { seed?: Record<string, WidgetDataResult>; children: React.ReactNode }) {
  const token = useDashboardActionToken();
  const [store] = React.useState(() => new DataStore(seed));
  store.token = token;
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useDataStore() {
  const s = React.useContext(StoreContext);
  if (!s) throw new Error("useDataStore needs <DashboardDataProvider>");
  return s;
}

export type WidgetData<T> = {
  data: T | undefined;
  error: string | null;
  status: number | null;
  loading: boolean;
  updatedAt: number;
  refresh: () => void;
  mutate: (updater: (data: T) => T) => void;
};

/**
 * Load (and keep fresh) one data request. Pass `null` to load nothing.
 * `refreshMs` = 0 disables polling; polling pauses while the tab is hidden.
 */
export function useWidgetData<T = unknown>(req: WidgetDataRequest | null, opts: { refreshMs?: number; enabled?: boolean } = {}): WidgetData<T> {
  const store = useDataStore();
  const id = req?.id ?? "";
  const enabled = Boolean(req) && opts.enabled !== false;
  const reqRef = React.useRef(req);
  reqRef.current = req;

  const subscribe = React.useCallback((fn: () => void) => (id ? store.subscribe(id, fn) : () => {}), [store, id]);
  const getSnapshot = React.useCallback(() => (id ? store.get(id) : undefined), [store, id]);
  const entry = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  React.useEffect(() => {
    if (!enabled || !reqRef.current) return;
    store.request(reqRef.current);
    const ms = opts.refreshMs ?? 60_000;
    if (!ms) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && reqRef.current) store.request(reqRef.current, { force: true });
    }, ms);
    const onVis = () => {
      if (document.visibilityState === "visible" && reqRef.current) store.request(reqRef.current, { maxAgeMs: ms });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [store, id, enabled, opts.refreshMs]);

  const refresh = React.useCallback(() => {
    if (reqRef.current) store.request(reqRef.current, { force: true });
  }, [store]);
  const mutate = React.useCallback((updater: (data: T) => T) => {
    if (id) store.mutate(id, (d) => updater(d as T));
  }, [store, id]);

  const result = entry?.result ?? null;
  return {
    data: result?.ok ? (result.data as T) : undefined,
    error: result && !result.ok ? result.error : null,
    status: result && !result.ok ? result.status : null,
    loading: enabled && (!entry || entry.loading || (!result && entry.inflight)),
    updatedAt: entry?.updatedAt ?? 0,
    refresh,
    mutate,
  };
}

/** Convenience: build the request inline. Params are compared by value. */
export function useDataKey<T = unknown>(key: string | null, params: Record<string, unknown> = {}, opts: { refreshMs?: number; enabled?: boolean } = {}) {
  const paramsKey = JSON.stringify(params);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const req = React.useMemo(() => (key ? makeRequest(key, params) : null), [key, paramsKey]);
  return useWidgetData<T>(req, opts);
}
