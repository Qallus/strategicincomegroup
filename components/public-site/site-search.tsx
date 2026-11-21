"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search, Sparkles } from "lucide-react";
import { SiteIcon } from "@/components/public-site/icons";
import { SEARCH_CATEGORIES, STATIC_INDEX, searchEntries, type SearchCategory, type SearchEntry } from "@/lib/public-site/search-index";
import { cn } from "@/lib/utils";

let articleCache: SearchEntry[] | null = null;

/** Opens the help FAB's Siggy chat with a question (SiteFab listens for this event). */
export function askSiggy(question: string) {
  window.dispatchEvent(new CustomEvent("sig:ask-siggy", { detail: question }));
}

/**
 * Header search dropdown: category tabs, a search field with "Ask Siggy",
 * and popular destinations (or ranked results) in a two-column grid.
 */
export function SiteSearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | SearchCategory>("all");
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<SearchEntry[]>(articleCache ?? []);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (articleCache) return;
    fetch("/api/public/search")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: SearchEntry[]) => {
        articleCache = rows;
        setArticles(rows);
      })
      .catch(() => undefined);
  }, []);

  const results = useMemo(() => {
    // The API returns the live team roster; when it does, drop the bundled static team entries.
    const liveTeam = articles.some((a) => a.href.startsWith("/team/"));
    // Same for careers: the API returns live job postings, replacing the bundled ones.
    const liveJobs = articles.some((a) => a.href.startsWith("/join-our-team/"));
    const base = STATIC_INDEX.filter((e) => !(liveTeam && e.href.startsWith("/team/")) && !(liveJobs && e.href.startsWith("/join-our-team/")));
    const pool = [...base, ...articles].filter((e) =>
      tab === "all" ? true : tab === "resources" ? e.category === "resources" || e.href.startsWith("/resources") : e.category === tab,
    );
    if (query.trim()) return searchEntries(pool, query).slice(0, 10);
    const popular = pool.filter((e) => e.popular);
    return (tab === "all" ? popular : popular.length >= 4 ? popular : pool).slice(0, 8);
  }, [articles, query, tab]);

  useEffect(() => setActive(0), [query, tab]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[active];
      if (hit) {
        router.push(hit.href);
        onClose();
      } else if (query.trim()) {
        askSiggy(query.trim());
        onClose();
      }
    }
  }

  const heading = query.trim() ? (results.length ? "Results" : "No matches") : tab === "all" ? "Popular" : SEARCH_CATEGORIES.find((c) => c.key === tab)?.label;

  return (
    <div className="sig-pop absolute inset-x-0 top-full z-50 border-b bg-background shadow-2xl shadow-black/10 dark:shadow-black/50">
      <div className="mx-auto w-full max-w-[880px] px-4 pb-6 pt-5 sm:px-6">
        <div role="tablist" aria-label="Search categories" className="-mx-2 flex gap-1 overflow-x-auto pb-1 sm:justify-center">
          {SEARCH_CATEGORIES.map((c) => (
            <button
              key={c.key}
              role="tab"
              aria-selected={tab === c.key}
              onClick={() => {
                setTab(c.key);
                inputRef.current?.focus();
              }}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-xs transition-colors sm:text-sm",
                tab === c.key ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <SiteIcon name={c.icon} className="h-5 w-5" />
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-full border bg-background p-1.5 pl-4 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/20">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search Strategic Income Group, or ask a question"
            aria-label="Search the site"
            role="combobox"
            aria-expanded
            aria-controls="site-search-results"
            className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => {
              askSiggy(query.trim());
              onClose();
            }}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[hsl(225_45%_12%)] px-4 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-brand-gold dark:text-[hsl(225_80%_10%)]"
          >
            <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Ask Siggy</span>
          </button>
        </div>

        <p className="mt-5 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{heading}</p>
        <ul id="site-search-results" role="listbox" className="mt-2 grid gap-2 sm:grid-cols-2">
          {results.map((r, i) => (
            <li key={r.href + r.title} role="option" aria-selected={i === active}>
              <Link
                href={r.href}
                onClick={onClose}
                onMouseEnter={() => setActive(i)}
                className={cn("group flex h-full items-center gap-3 rounded-xl border p-3 transition-colors", i === active ? "border-primary/40 bg-muted" : "hover:bg-muted")}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
                  <SiteIcon name={r.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.description}</span>
                </span>
                {i === active ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
              </Link>
            </li>
          ))}
        </ul>
        {query.trim() && !results.length ? (
          <button
            type="button"
            onClick={() => {
              askSiggy(query.trim());
              onClose();
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed p-4 text-left text-sm hover:bg-muted"
          >
            <Sparkles className="h-4 w-4 text-gold" /> Ask Siggy “{query.trim()}”
          </button>
        ) : null}

        <p className="mt-4 px-1 text-xs text-muted-foreground">
          Tip: press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">/</kbd> anywhere to search, use ↑ ↓ to move and Enter to open.
        </p>
      </div>
    </div>
  );
}
