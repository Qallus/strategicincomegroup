"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Filter, FolderInput, Hash, Mail, Plus, Tag, Tags, Trash2, UserMinus, UserPlus, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldSelect } from "@/components/ui/field-select";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import {
  createTag, deleteTags, setTagsCategory, tagParticipants, untagParticipants, updateTag,
} from "@/app/dashboard/tags-segments/actions";
import { cn } from "@/lib/utils";

export type TagRow = {
  id: string;
  name: string;
  category: string | null;
  created_at?: string | null;
  participant_tags?: { participant_id: string }[];
};

export type ParticipantRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone?: string | null;
  wave: string | null;
  source: string | null;
  participant_type: string | null;
  check_in_status: string | null;
  survey_status?: string | null;
  inner_circle_status?: string | null;
  participant_tags?: { tags?: { id: string; name: string; category: string | null } | null }[];
};

const fmt = (v: string | null | undefined) => (v ? v.replaceAll("_", " ") : "-");
const cat = (t: TagRow) => t.category || "general";
const uses = (t: TagRow) => t.participant_tags?.length ?? 0;
const pName = (p: ParticipantRow) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email || "Unknown";
const pTags = (p: ParticipantRow) => (p.participant_tags ?? []).map((r) => r.tags).filter((t): t is NonNullable<typeof t> => Boolean(t));
const pStatus = (p: ParticipantRow) => p.check_in_status ?? p.survey_status ?? null;

type Ask =
  | { kind: "newTag" }
  | { kind: "category"; tags: TagRow[] }
  | { kind: "tagPeople" | "untagPeople"; people: ParticipantRow[] };

export function TagsSegmentsDashboard({ tags, participants }: { tags: TagRow[]; participants: ParticipantRow[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<"all" | "any">("all");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [text, setText] = useState("");
  const [text2, setText2] = useState("");
  const [pickedTags, setPickedTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const segmentRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => Array.from(new Set(tags.map(cat))).sort(), [tags]);
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const peopleById = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);

  const matchingParticipants = useMemo(() => {
    if (!selectedTagIds.length) return participants;
    return participants.filter((p) => {
      const have = new Set(pTags(p).map((t) => t.id));
      return matchMode === "all" ? selectedTagIds.every((id) => have.has(id)) : selectedTagIds.some((id) => have.has(id));
    });
  }, [participants, selectedTagIds, matchMode]);

  const unusedCount = tags.filter((t) => !uses(t)).length;
  const toggleSegmentTag = (id: string) => setSelectedTagIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const refresh = () => startRefresh(() => router.refresh());

  async function act(p: Promise<{ ok: true } | { ok: false; error: string }>) {
    const res = await p;
    if (!res.ok) throw new Error(res.error);
    refresh();
  }

  function open(next: Ask) {
    setAsk(next);
    setAskError(null);
    setText("");
    setText2(next.kind === "category" && next.tags.length === 1 ? cat(next.tags[0]) : next.kind === "newTag" ? "general" : "");
    setPickedTags([]);
  }

  async function submitAsk() {
    if (!ask) return;
    setBusy(true);
    setAskError(null);
    try {
      if (ask.kind === "newTag") await act(createTag(text, text2));
      else if (ask.kind === "category") await act(setTagsCategory(ask.tags.map((t) => t.id), text2));
      else if (ask.kind === "tagPeople") await act(tagParticipants(pickedTags, ask.people.map((p) => p.id)));
      else await act(untagParticipants(pickedTags, ask.people.map((p) => p.id)));
      setAsk(null);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const tagColumns: DataColumn<TagRow>[] = [
    { id: "name", label: "Tag", required: true, width: 240, cell: (t) => <span className="font-medium">{t.name}</span>, sort: (t) => t.name },
    { id: "category", label: "Category", width: 170, cell: (t) => <span className="capitalize">{fmt(cat(t))}</span>, sort: cat },
    { id: "count", label: "Participants", width: 130, align: "right", cell: uses, sort: uses },
    {
      id: "segment", label: "In segment", width: 120, align: "center",
      cell: (t) => (selectedTagIds.includes(t.id) ? <Badge variant="secondary" className="text-[10px]">Selected</Badge> : "—"),
    },
    { id: "created", label: "Created", width: 130, defaultHidden: true, cell: (t) => (t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"), sort: (t) => t.created_at ?? null },
  ];

  const peopleColumns: DataColumn<ParticipantRow>[] = [
    { id: "name", label: "Name", required: true, width: 220, cell: (p) => <span className="font-medium">{pName(p)}</span>, sort: pName },
    { id: "email", label: "Email", width: 240, cell: (p) => p.email ?? "—", sort: (p) => p.email },
    { id: "wave", label: "Wave/source", width: 150, cell: (p) => p.wave ?? p.source ?? "—", sort: (p) => p.wave ?? p.source },
    { id: "type", label: "Type", width: 150, cell: (p) => <span className="capitalize">{fmt(p.participant_type)}</span>, sort: (p) => p.participant_type },
    { id: "status", label: "Status", width: 150, cell: (p) => <span className="capitalize">{fmt(pStatus(p))}</span>, sort: pStatus },
    {
      id: "tags", label: "Tags", width: 300,
      cell: (p) => (
        <span className="flex gap-1 overflow-hidden">
          {pTags(p).slice(0, 4).map((t) => <Badge key={t.id} variant="secondary" className="shrink-0 text-[10px]">{t.name}</Badge>)}
          {pTags(p).length > 4 ? <Badge variant="outline" className="shrink-0 text-[10px]">+{pTags(p).length - 4}</Badge> : null}
          {!pTags(p).length ? "—" : null}
        </span>
      ),
      sort: (p) => pTags(p).length,
      exportValue: (p) => pTags(p).map((t) => t.name).join("; "),
    },
  ];

  const waves = Array.from(new Set(participants.map((p) => p.wave).filter((w): w is string => Boolean(w)))).sort();
  const types = Array.from(new Set(participants.map((p) => p.participant_type).filter((w): w is string => Boolean(w)))).sort();
  const peopleTagOptions = ask && (ask.kind === "untagPeople")
    ? Array.from(new Map(ask.people.flatMap(pTags).map((t) => [t.id, t])).values()).sort((a, b) => a.name.localeCompare(b.name))
    : tags;

  return (
    <div className="space-y-10">
      {/* ── Tags ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tags</h2>
        <DataView<TagRow>
          storageKey="tags-segments.tags"
          exportName="sig-tags"
          noun={["tag", "tags"]}
          loading={refreshing}
          items={tags}
          getId={(t) => t.id}
          title={(t) => t.name}
          subtitle={(t) => `${fmt(cat(t))} · ${uses(t)} participant${uses(t) === 1 ? "" : "s"}`}
          media={(t) => (
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", selectedTagIds.includes(t.id) ? "border-primary bg-primary text-primary-foreground" : "bg-background text-primary")}>
              <Hash className="h-4 w-4" />
            </span>
          )}
          badge={(t) => <Badge variant={uses(t) ? "default" : "outline"} className="shrink-0 text-[10px] tabular-nums">{uses(t)}</Badge>}
          columns={tagColumns}
          searchText={(t) => `${t.name} ${cat(t)} ${fmt(cat(t))}`}
          stats={[
            { label: "Total tags", value: tags.length, icon: Tags, hint: "Available segment labels" },
            { label: "Active tags", value: tags.length - unusedCount, icon: Tag, hint: "Assigned to participants" },
            { label: "Unused tags", value: unusedCount, icon: Hash, hint: "Available but not assigned" },
            {
              label: "Segment preview", value: matchingParticipants.length, icon: Users, hint: selectedTagIds.length ? `${selectedTagIds.length} tag${selectedTagIds.length === 1 ? "" : "s"} · match ${matchMode}` : "Matching participants",
              onClick: () => segmentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
            },
          ]}
          filters={[
            { id: "all", label: "All", test: () => true },
            { id: "used", label: "In use", test: (t) => uses(t) > 0 },
            { id: "unused", label: "Unused", test: (t) => uses(t) === 0 },
            { id: "segment", label: "In segment", test: (t) => selectedTagIds.includes(t.id) },
          ]}
          selectFilters={[{ id: "category", label: "Category", options: categories.map((c) => ({ value: c, label: fmt(c) })), get: cat }]}
          board={{
            lanes: categories.map((c) => ({ id: c, label: fmt(c) })),
            get: cat,
            onMove: (t, lane) => act(updateTag(t.id, { category: lane })).catch((e) => window.alert(e instanceof Error ? e.message : "Move failed.")),
          }}
          actions={[
            {
              label: "Build segment", icon: Filter,
              run: (sel) => { setSelectedTagIds(sel.map((t) => t.id)); segmentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); },
            },
            {
              label: "Add to segment", icon: Plus, show: (sel) => sel.some((t) => !selectedTagIds.includes(t.id)),
              run: (sel) => setSelectedTagIds((cur) => Array.from(new Set([...cur, ...sel.map((t) => t.id)]))),
            },
            { label: "Category", icon: FolderInput, run: (sel) => open({ kind: "category", tags: sel }) },
            {
              label: "Delete", icon: Trash2, destructive: true,
              run: (sel) => {
                const tagged = sel.reduce((n, t) => n + uses(t), 0);
                if (!window.confirm(`Delete ${sel.length} tag${sel.length === 1 ? "" : "s"}?${tagged ? ` They're removed from ${tagged} participant tag assignment${tagged === 1 ? "" : "s"}.` : ""} This cannot be undone.`)) return;
                setSelectedTagIds((cur) => cur.filter((id) => !sel.some((t) => t.id === id)));
                return act(deleteTags(sel.map((t) => t.id)));
              },
            },
          ]}
          add={{ label: "New tag", onClick: () => open({ kind: "newTag" }) }}
          preview={(t, close) => (
            <TagDetail
              key={t.id}
              tag={t}
              categories={categories}
              inSegment={selectedTagIds.includes(t.id)}
              people={(t.participant_tags ?? []).map((r) => peopleById.get(r.participant_id)).filter((p): p is ParticipantRow => Boolean(p))}
              onToggleSegment={() => toggleSegmentTag(t.id)}
              onSave={(patch) => act(updateTag(t.id, patch))}
              onDelete={async () => {
                if (!window.confirm(`Delete "${t.name}"? It's removed from ${uses(t)} participant${uses(t) === 1 ? "" : "s"}.`)) return;
                await act(deleteTags([t.id]));
                setSelectedTagIds((cur) => cur.filter((id) => id !== t.id));
                close();
              }}
            />
          )}
          empty="No tags yet. Create one to start segmenting participants."
        />
      </section>

      {/* ── Segment builder ── */}
      <section ref={segmentRef} className="scroll-mt-20 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Segment builder</h2>
            <p className="text-sm text-muted-foreground">Preview participants by selected tags before sending emails or doing follow-up.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Tags className="h-3.5 w-3.5" /> Choose tags
                  {selectedTagIds.length ? <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{selectedTagIds.length}</span> : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
                {categories.map((c) => (
                  <div key={c}>
                    <DropdownMenuLabel className="text-xs capitalize text-muted-foreground">{fmt(c)}</DropdownMenuLabel>
                    {tags.filter((t) => cat(t) === c).map((t) => (
                      <DropdownMenuCheckboxItem key={t.id} checked={selectedTagIds.includes(t.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => toggleSegmentTag(t.id)}>
                        <span className="flex-1 truncate">{t.name}</span>
                        <span className="ml-2 text-xs tabular-nums text-muted-foreground">{uses(t)}</span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                ))}
                {!tags.length ? <p className="px-2 py-1.5 text-sm text-muted-foreground">No tags yet.</p> : null}
                {selectedTagIds.length ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setSelectedTagIds([])}>Clear selected tags</DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-56">
              <FieldSelect
                value={matchMode}
                onChange={(v) => setMatchMode(v as "all" | "any")}
                options={[{ value: "all", label: "Has all selected tags" }, { value: "any", label: "Has any selected tag" }]}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {selectedTagIds.map((id) => {
            const t = tagById.get(id);
            return t ? (
              <Button key={id} type="button" variant="secondary" size="sm" onClick={() => toggleSegmentTag(id)} title="Remove from segment">
                <Tags className="h-3.5 w-3.5" /> {t.name} <X className="h-3 w-3 opacity-60" />
              </Button>
            ) : null;
          })}
          {selectedTagIds.length ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedTagIds([])}>Clear selected tags</Button>
          ) : (
            <p className="text-sm text-muted-foreground">Pick tags with “Choose tags”, or tick tags above and use “Build segment”. With no tags selected, everyone is shown.</p>
          )}
        </div>

        <DataView<ParticipantRow>
          storageKey="tags-segments.participants"
          exportName="sig-segment"
          noun={["participant", "participants"]}
          loading={refreshing}
          items={matchingParticipants}
          getId={(p) => p.id}
          title={pName}
          subtitle={(p) => p.email ?? p.wave ?? p.source ?? "—"}
          media={(p) => (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {(`${(p.first_name ?? "").charAt(0)}${(p.last_name ?? "").charAt(0)}` || (p.email ?? "?").charAt(0)).toUpperCase()}
            </span>
          )}
          meta={(p) => `${pTags(p).length} tag${pTags(p).length === 1 ? "" : "s"}`}
          columns={peopleColumns}
          searchText={(p) => [pName(p), p.email, p.wave, p.source, p.participant_type, pStatus(p), pTags(p).map((t) => t.name).join(" ")].join(" ")}
          selectFilters={[
            { id: "wave", label: "Wave", options: waves.map((w) => ({ value: w, label: w })), get: (p) => p.wave },
            { id: "type", label: "Type", options: types.map((t) => ({ value: t, label: fmt(t) })), get: (p) => p.participant_type },
          ]}
          actions={[
            { label: "Add tags", icon: UserPlus, run: (sel) => open({ kind: "tagPeople", people: sel }) },
            { label: "Remove tags", icon: UserMinus, show: (sel) => sel.some((p) => pTags(p).length), run: (sel) => open({ kind: "untagPeople", people: sel }) },
            {
              label: "Email", icon: Mail, show: (sel) => sel.some((p) => p.email),
              run: (sel) => void window.open(`mailto:?bcc=${encodeURIComponent(sel.map((p) => p.email).filter(Boolean).join(","))}`),
            },
          ]}
          preview={(p) => (
            <ParticipantDetail
              p={p}
              tags={tags}
              onAdd={(tagId) => act(tagParticipants([tagId], [p.id]))}
              onRemove={(tagId) => act(untagParticipants([tagId], [p.id]))}
            />
          )}
          empty={selectedTagIds.length ? "No participants match this segment." : "No participants yet."}
        />
      </section>

      {/* ── Small dialogs ── */}
      <Dialog open={Boolean(ask)} onOpenChange={(o) => !o && !busy && setAsk(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {ask?.kind === "newTag" ? "New tag" : ask?.kind === "category" ? "Change category" : ask?.kind === "tagPeople" ? "Add tags" : "Remove tags"}
            </DialogTitle>
            {ask && ask.kind !== "newTag" ? (
              <DialogDescription>
                {ask.kind === "category" ? `${ask.tags.length} tag${ask.tags.length === 1 ? "" : "s"} selected.` : `${ask.people.length} participant${ask.people.length === 1 ? "" : "s"} selected.`}
              </DialogDescription>
            ) : null}
          </DialogHeader>

          {ask?.kind === "newTag" ? (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tag-name">Name</Label>
                <Input id="tag-name" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Church interest" onKeyDown={(e) => e.key === "Enter" && text.trim() && void submitAsk()} />
              </div>
              <CategoryInput value={text2} onChange={setText2} categories={categories} />
            </div>
          ) : ask?.kind === "category" ? (
            <CategoryInput value={text2} onChange={setText2} categories={categories} />
          ) : ask ? (
            <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">
              {peopleTagOptions.map((t) => {
                const on = pickedTags.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPickedTags((cur) => (on ? cur.filter((x) => x !== t.id) : [...cur, t.id]))}
                    className={cn("rounded-full border px-2.5 py-0.5 text-xs", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                  >
                    {t.name}
                  </button>
                );
              })}
              {!peopleTagOptions.length ? <p className="text-sm text-muted-foreground">No tags to choose from — create one in the Tags list first.</p> : null}
            </div>
          ) : null}

          {askError ? <p className="text-sm text-destructive">{askError}</p> : null}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAsk(null)} disabled={busy}>Cancel</Button>
            <Button
              onClick={() => void submitAsk()}
              disabled={busy || (ask?.kind === "newTag" && !text.trim()) || ((ask?.kind === "tagPeople" || ask?.kind === "untagPeople") && !pickedTags.length)}
            >
              {busy ? "Saving…" : ask?.kind === "newTag" ? "Create" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryInput({ value, onChange, categories }: { value: string; onChange: (v: string) => void; categories: string[] }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="tag-category">Category</Label>
      <Input id="tag-category" value={value} onChange={(e) => onChange(e.target.value)} placeholder="general" list="tag-categories" />
      <datalist id="tag-categories">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>
    </div>
  );
}

function TagDetail({
  tag, categories, inSegment, people, onToggleSegment, onSave, onDelete,
}: {
  tag: TagRow;
  categories: string[];
  inSegment: boolean;
  people: ParticipantRow[];
  onToggleSegment: () => void;
  onSave: (patch: { name: string; category: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(tag.name);
  const [category, setCategory] = useState(cat(tag));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const dirty = name.trim() !== tag.name || category.trim() !== cat(tag);

  async function wrap(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ text: ok });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "That didn't work.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tag-edit-name">Name</Label>
          <Input id="tag-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <CategoryInput value={category} onChange={setCategory} categories={categories} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!dirty || busy || !name.trim()} onClick={() => void wrap(() => onSave({ name, category }), "Saved.")}>Save</Button>
          <Button size="sm" variant={inSegment ? "secondary" : "outline"} onClick={onToggleSegment}>
            <Filter className="h-3.5 w-3.5" /> {inSegment ? "Remove from segment" : "Use in segment"}
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" disabled={busy} onClick={() => void wrap(onDelete)} aria-label="Delete tag" title="Delete tag">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {msg ? <p className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.text}</p> : null}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Participants ({people.length})</p>
        <ul className="mt-2 divide-y rounded-xl border">
          {people.slice(0, 100).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate font-medium">{pName(p)}</span>
              <span className="truncate text-xs text-muted-foreground">{p.email ?? "—"}</span>
            </li>
          ))}
          {!people.length ? <li className="px-3 py-3 text-sm text-muted-foreground">Nobody has this tag yet.</li> : null}
          {people.length > 100 ? <li className="px-3 py-2 text-xs text-muted-foreground">+{people.length - 100} more — use the segment builder to see everyone.</li> : null}
        </ul>
      </div>
    </div>
  );
}

function ParticipantDetail({
  p, tags, onAdd, onRemove,
}: {
  p: ParticipantRow;
  tags: TagRow[];
  onAdd: (tagId: string) => Promise<void>;
  onRemove: (tagId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string | null>(null);
  const have = pTags(p);
  const available = tags.filter((t) => !have.some((h) => h.id === t.id));
  const run = (fn: () => Promise<void>) => fn().then(() => setError(null)).catch((e) => setError(e instanceof Error ? e.message : "That didn't work."));
  return (
    <div className="space-y-6">
      <dl className="grid gap-2.5 rounded-xl border bg-muted/30 p-4 text-sm">
        {(
          [
            ["Email", p.email],
            ["Phone", p.phone ?? null],
            ["Wave", p.wave],
            ["Source", p.source],
            ["Type", p.participant_type ? fmt(p.participant_type) : null],
            ["Check-in", p.check_in_status ? fmt(p.check_in_status) : null],
            ["Survey", p.survey_status ? fmt(p.survey_status) : null],
            ["Inner circle", p.inner_circle_status ? fmt(p.inner_circle_status) : null],
          ] as [string, string | null][]
        )
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="grid grid-cols-[96px_1fr] gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words capitalize">{v}</dd>
            </div>
          ))}
      </dl>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Tags</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {have.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs">
              {t.name}
              <button type="button" aria-label={`Remove ${t.name}`} onClick={() => void run(() => onRemove(t.id))} className="rounded-full opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {!have.length ? <p className="text-sm text-muted-foreground">No tags.</p> : null}
        </div>
        {available.length ? (
          <div className="mt-3 flex gap-2">
            <div className="min-w-0 flex-1">
              <FieldSelect value={adding} onChange={setAdding} placeholder="Add a tag…" options={available.map((t) => ({ value: t.id, label: t.name }))} />
            </div>
            <Button size="sm" className="h-10" disabled={!adding} onClick={() => void run(() => onAdd(adding)).then(() => setAdding(""))}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>
      {p.email ? (
        <Button asChild size="sm" variant="outline">
          <a href={`mailto:${p.email}`}><Mail className="h-4 w-4" /> Email</a>
        </Button>
      ) : null}
    </div>
  );
}
