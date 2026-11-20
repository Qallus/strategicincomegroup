"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, EyeOff, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { PickerItem } from "@/lib/team/fields";
import { cn } from "@/lib/utils";


/** Admins: jump between employees' team profiles. */
export function TeamProfilePicker({ items, currentSlug, editingOther }: { items: PickerItem[]; currentSlug: string | null; editingOther: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const current = items.find((i) => i.slug === currentSlug);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((i) => `${i.name} ${i.jobTitle ?? ""}`.toLowerCase().includes(t)) : items;
  }, [items, q]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="font-medium">Team profiles</p>
          <p className="truncate text-xs text-muted-foreground">
            {editingOther && current ? <>Editing <span className="font-medium text-foreground">{current.name}</span> as an admin</> : "As an admin you can edit anyone's team page."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {editingOther ? (
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard/profile">My profile</Link></Button>
        ) : null}
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between gap-2 sm:w-64">
              <span className="truncate">{current ? current.name : "Choose a team member…"}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
            <div className="border-b p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search team…"
                  className="h-8 pl-8"
                />
              </div>
            </div>
            <ul className="max-h-80 overflow-y-auto p-1">
              {filtered.map((i) => (
                <li key={i.slug}>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); router.push(i.isMine ? "/dashboard/profile" : `/dashboard/profile/${i.slug}`); }}
                    className={cn("flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent", i.slug === currentSlug && "bg-accent/60")}
                  >
                    {i.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border object-cover object-top" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i.name.charAt(0)}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate font-medium">
                        {i.name}{i.isMine ? <span className="text-xs font-normal text-muted-foreground">(you)</span> : null}
                        {!i.isPublished ? <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Hidden" /> : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{i.jobTitle || "—"}</span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{i.percent}%</span>
                    {i.slug === currentSlug ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                  </button>
                </li>
              ))}
              {!filtered.length ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</li> : null}
            </ul>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
