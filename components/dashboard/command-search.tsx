"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, FileText, LayoutGrid, Loader2, Plus, UserRound, Wand2 } from "lucide-react";
import { featuresFor } from "@/lib/dashboard/features";
import type { Permission } from "@/lib/rbac/permissions";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";

type Hit = { id: string; group: "contacts" | "bookings" | "posts"; title: string; subtitle: string | null; href: string };

const GROUPS: { key: Hit["group"]; label: string; icon: typeof UserRound }[] = [
  { key: "contacts", label: "Contacts", icon: UserRound },
  { key: "bookings", label: "Bookings", icon: CalendarClock },
  { key: "posts", label: "Posts", icon: FileText },
];

export function CommandSearch({
  open,
  onOpenChange,
  permissions,
  onAction,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  permissions: Permission[];
  onAction: (a: "add_card" | "wizard" | "features") => void;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [busy, setBusy] = React.useState(false);
  const features = React.useMemo(() => featuresFor(permissions), [permissions]);

  React.useEffect(() => {
    if (!open) {
      setQ("");
      setHits([]);
    }
  }, [open]);

  React.useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const j = (await res.json().catch(() => ({}))) as { hits?: Hit[] };
        setHits(j.hits ?? []);
      } catch {
        /* aborted */
      } finally {
        setBusy(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const needle = q.trim().toLowerCase();
  const matchedFeatures = features.filter((f) => !needle || [f.label, f.description, f.group, ...(f.keywords ?? [])].join(" ").toLowerCase().includes(needle)).slice(0, needle ? 8 : 6);
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder="Search features, contacts, bookings, posts…"
        trailing={busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : <kbd className="hidden rounded border border-border px-1.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>}
      />
      <CommandList>
        <CommandEmpty>{busy ? "Searching…" : needle.length < 2 ? "Type to search." : "No results."}</CommandEmpty>
        {!needle ? (
          <CommandGroup heading="Dashboard">
            <CommandItem value="add-card" onSelect={() => { onOpenChange(false); onAction("add_card"); }}>
              <Plus aria-hidden /> Add a card
            </CommandItem>
            <CommandItem value="wizard" onSelect={() => { onOpenChange(false); onAction("wizard"); }}>
              <Wand2 aria-hidden /> Get started wizard
            </CommandItem>
            <CommandItem value="all-features" onSelect={() => { onOpenChange(false); onAction("features"); }}>
              <LayoutGrid aria-hidden /> All features
            </CommandItem>
          </CommandGroup>
        ) : null}
        {matchedFeatures.length ? (
          <CommandGroup heading="Features">
            {matchedFeatures.map((f) => (
              <CommandItem key={f.href} value={`feature:${f.href}`} onSelect={() => go(f.href)}>
                <f.icon className="text-brand-gold" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{f.description}</span>
                </span>
                <CommandShortcut>{f.group}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {GROUPS.map((g) => {
          const items = hits.filter((h) => h.group === g.key);
          if (!items.length) return null;
          return (
            <React.Fragment key={g.key}>
              <CommandSeparator />
              <CommandGroup heading={g.label}>
                {items.map((h) => (
                  <CommandItem key={`${g.key}:${h.id}`} value={`${g.key}:${h.id}`} onSelect={() => go(h.href)}>
                    <g.icon className="text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{h.title}</span>
                      {h.subtitle ? <span className="block truncate text-xs text-muted-foreground">{h.subtitle}</span> : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
