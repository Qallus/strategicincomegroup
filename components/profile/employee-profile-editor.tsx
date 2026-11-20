"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Camera, Check, Clock, ExternalLink, Eye, EyeOff, GripVertical,
  ImagePlus, Images, Link2, Linkedin, Loader2, Mail, MapPin, Phone, RotateCcw, Save,
  Sparkles, Trash2, Upload, UserRound, X,
} from "lucide-react";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { FieldSelect } from "@/components/ui/field-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import {
  OFFICES, TEAM_GROUPS, TEAM_GROUP_LABELS, WORK_DAYS, completeness, formatTime, formatWorkDays,
  type EmployeeProfile,
} from "@/lib/team/fields";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
type Draft = {
  full_name: string; first_name: string; last_name: string; job_title: string; credentials: string; office: string;
  employment_date: string; photo_url: string; gallery_urls: string[];
  experience: string; inspires: string; hobbies: string; best_purchase: string; favorite_destination: string;
  why_love_job: string; favorite_quote: string;
  phone: string; email: string; linkedin_url: string;
  work_days: string[]; start_time: string; close_time: string;
  is_published: boolean;
  slug: string; team_group: string; booking_href: string; sort_order: string; account_email: string;
};
type DraftKey = keyof Draft;

const ADMIN_KEYS: DraftKey[] = ["slug", "team_group", "booking_href", "sort_order", "account_email"];

function toDraft(p: EmployeeProfile | null, defaults: { firstName: string; lastName: string }): Draft {
  return {
    full_name: p?.full_name ?? "",
    first_name: p?.first_name ?? (p ? "" : defaults.firstName),
    last_name: p?.last_name ?? (p ? "" : defaults.lastName),
    job_title: p?.job_title ?? "",
    credentials: p?.credentials ?? "",
    office: p?.office ?? "",
    employment_date: p?.employment_date ?? "",
    photo_url: p?.photo_url ?? "",
    gallery_urls: p?.gallery_urls ?? [],
    experience: p?.experience ?? "",
    inspires: p?.inspires ?? "",
    hobbies: p?.hobbies ?? "",
    best_purchase: p?.best_purchase ?? "",
    favorite_destination: p?.favorite_destination ?? "",
    why_love_job: p?.why_love_job ?? "",
    favorite_quote: p?.favorite_quote ?? "",
    phone: p?.phone ?? "",
    email: p?.email ?? "",
    linkedin_url: p?.linkedin_url ?? "",
    work_days: p?.work_days ?? [],
    start_time: p?.start_time?.slice(0, 5) ?? "",
    close_time: p?.close_time?.slice(0, 5) ?? "",
    is_published: p?.is_published ?? false,
    slug: p?.slug ?? "",
    team_group: p?.team_group ?? "admin",
    booking_href: p?.booking_href ?? "",
    sort_order: String(p?.sort_order ?? 0),
    account_email: p?.account_email ?? "",
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function toPayload(d: Draft, keys: DraftKey[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = k === "sort_order" ? Number(d.sort_order) || 0 : d[k];
  return out;
}

const TABS = [
  { value: "basics", label: "Basics", icon: UserRound },
  { value: "about", label: "About me", icon: Sparkles },
  { value: "contact", label: "Contact", icon: Mail },
  { value: "schedule", label: "Schedule", icon: Clock },
  { value: "gallery", label: "Gallery", icon: Images },
  { value: "website", label: "Website", icon: Eye },
] as const;
type TabValue = (typeof TABS)[number]["value"];

const FIELD_TAB: Record<string, TabValue> = {
  "Profile photo": "basics", "First name": "basics", "Last name": "basics", "Job title": "basics", "Date of employment": "basics",
  "Professional experience": "about", "Who inspires you": "about", "Favorite hobbies": "about", "Best purchase under $100": "about",
  "Favorite destination": "about", "Why you love your job": "about", "Favorite quote": "about",
  Phone: "contact", Email: "contact", LinkedIn: "contact",
  "Work days": "schedule", "Start time": "schedule", "Close time": "schedule", "Photo gallery": "gallery",
};

// ── Upload helper (XHR for progress) ─────────────────────────────────────────
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

function uploadImage(file: File, opts: { kind: "photo" | "gallery"; slug?: string; token: string; onProgress: (pct: number) => void }) {
  return new Promise<string>((resolve, reject) => {
    if (!ACCEPT.split(",").includes(file.type)) return reject(new Error(`${file.name}: choose a JPG, PNG, WebP, GIF or AVIF image.`));
    if (file.size > MAX_BYTES) return reject(new Error(`${file.name} is larger than 8 MB.`));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", opts.kind);
    if (opts.slug) fd.append("slug", opts.slug);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/me/employee-profile/upload");
    if (opts.token) xhr.setRequestHeader("x-sig-action-token", opts.token);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let data: { url?: string; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data.url);
      else reject(new Error(data.error || "Upload failed."));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.send(fd);
  });
}

// ── Small building blocks ────────────────────────────────────────────────────
function Field({ label, hint, htmlFor, children, className, count, max }: {
  label: string; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode; className?: string; count?: number; max?: number;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {max ? <span className={cn("text-[11px] tabular-nums text-muted-foreground", (count ?? 0) > max && "text-destructive")}>{count ?? 0}/{max}</span> : null}
      </div>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SectionCard({ title, description, icon: Icon, children, action }: {
  title: string; description?: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <CardContent className="p-5 sm:p-6">{children}</CardContent>
    </Card>
  );
}

function CompletenessRing({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} className="fill-none stroke-muted" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} strokeWidth="6" strokeLinecap="round"
          className={cn("fill-none transition-[stroke-dashoffset] duration-500", percent >= 100 ? "stroke-emerald-500" : "stroke-primary")}
          strokeDasharray={c} strokeDashoffset={c - (c * percent) / 100}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{percent}%</span>
    </div>
  );
}

// ── Photo drop zone ──────────────────────────────────────────────────────────
function PhotoDrop({ url, name, busy, progress, onFile, onRemove }: {
  url: string; name: string; busy: boolean; progress: number; onFile: (f: File) => void; onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  return (
    <div className="flex w-full flex-col items-center gap-3 sm:w-auto">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
        disabled={busy}
        aria-label={url ? "Replace profile photo" : "Upload profile photo"}
        className={cn(
          "group relative aspect-[4/5] w-44 overflow-hidden rounded-2xl border-2 bg-gradient-to-b from-muted to-background shadow-sm outline-none transition sm:w-48 xl:w-52",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          over ? "border-primary ring-4 ring-primary/20" : url ? "border-transparent" : "border-dashed border-muted-foreground/30 hover:border-primary/60",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="font-serif text-4xl text-muted-foreground/70">{initials}</span>
            <span className="text-xs text-muted-foreground">Drop a photo here<br />or click to browse</span>
          </span>
        )}
        <span className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 text-sm font-medium text-white transition-opacity",
          busy || over ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}>
          {busy ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="tabular-nums">{progress}%</span>
              <span className="mx-6 h-1.5 w-28 overflow-hidden rounded-full bg-white/25">
                <span className="block h-full rounded-full bg-white transition-[width]" style={{ width: `${progress}%` }} />
              </span>
            </>
          ) : (
            <>
              <Camera className="h-6 w-6" />
              {over ? "Drop to upload" : url ? "Replace photo" : "Upload photo"}
            </>
          )}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
      <div className="flex items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1.5 h-3.5 w-3.5" /> {url ? "Replace" : "Upload"}
        </Button>
        {url ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRemove} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
          </Button>
        ) : null}
      </div>
      <p className="text-center text-[11px] text-muted-foreground">Portrait works best · JPG, PNG or WebP · up to 8 MB</p>
    </div>
  );
}

// ── Gallery ──────────────────────────────────────────────────────────────────
type Pending = { id: string; preview: string; progress: number; error?: string };

function Gallery({ urls, pending, onFiles, onChange, busy }: {
  urls: string[]; pending: Pending[]; onFiles: (files: File[]) => void; onChange: (urls: string[]) => void; busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= urls.length || from === to) return;
    const next = [...urls];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { if (dragIndex === null) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (dragIndex !== null) return;
          e.preventDefault(); setOver(false);
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length) onFiles(files);
        }}
        className={cn(
          "grid grid-cols-2 gap-3 rounded-xl sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6",
          over && "outline-dashed outline-2 outline-offset-4 outline-primary",
        )}
      >
        {urls.map((u, i) => (
          <figure
            key={u}
            draggable
            onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { if (dragIndex !== null) { e.preventDefault(); setDropIndex(i); } }}
            onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
            onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) move(dragIndex, i); setDragIndex(null); setDropIndex(null); }}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-xl border bg-muted shadow-sm transition",
              dragIndex === i && "opacity-40",
              dropIndex === i && dragIndex !== i && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Gallery photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
            <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">{i + 1}</span>
            <span className="absolute right-2 top-2 hidden cursor-grab rounded-md bg-black/55 p-1 text-white sm:block" aria-hidden>
              <GripVertical className="h-3.5 w-3.5" />
            </span>
            <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <span className="flex gap-1">
                <button type="button" disabled={busy || i === 0} onClick={() => move(i, i - 1)} aria-label="Move earlier"
                  className="rounded-md bg-white/90 p-1.5 text-neutral-900 hover:bg-white disabled:opacity-40">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={busy || i === urls.length - 1} onClick={() => move(i, i + 1)} aria-label="Move later"
                  className="rounded-md bg-white/90 p-1.5 text-neutral-900 hover:bg-white disabled:opacity-40">
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </span>
              <button type="button" disabled={busy} onClick={() => onChange(urls.filter((x) => x !== u))} aria-label="Remove photo"
                className="rounded-md bg-white/90 p-1.5 text-red-600 hover:bg-white disabled:opacity-40">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </figcaption>
          </figure>
        ))}

        {pending.map((p) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className="h-full w-full object-cover opacity-50" />
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/40 p-3 text-center text-xs font-medium">
              {p.error ? (
                <><AlertCircle className="h-5 w-5 text-destructive" /><span className="text-destructive">{p.error}</span></>
              ) : (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="h-1.5 w-3/4 overflow-hidden rounded-full bg-muted-foreground/20">
                    <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${p.progress}%` }} />
                  </span>
                </>
              )}
            </span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 p-3 text-center text-sm text-muted-foreground transition hover:border-primary/60 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ImagePlus className="h-6 w-6" />
          <span className="font-medium">Add photos</span>
          <span className="text-[11px]">Drop or click · multiple OK</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) onFiles(files); e.target.value = ""; }}
      />
      {urls.length > 1 ? <p className="text-xs text-muted-foreground">Drag photos (or use the arrows) to set the order they appear on your page.</p> : null}
    </div>
  );
}

// ── Main editor ──────────────────────────────────────────────────────────────
export type EmployeeProfileEditorProps = {
  initial: EmployeeProfile | null;
  mode: "self" | "admin";
  isAdmin: boolean;
  defaults: { firstName: string; lastName: string; email: string };
  account?: { email: string; roleLabel: string; memberSince: string | null };
  /** Rendered above the editor (admin team picker). */
  toolbar?: React.ReactNode;
};

export function EmployeeProfileEditor({ initial, mode, isAdmin, defaults, account, toolbar }: EmployeeProfileEditorProps) {
  const router = useRouter();
  const token = useDashboardActionToken();
  const [row, setRow] = useState<EmployeeProfile | null>(initial);
  const [saved, setSaved] = useState<Draft>(() => toDraft(initial, defaults));
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial, defaults));
  const [tab, setTab] = useState<TabValue>("basics");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);

  const editableKeys = useMemo(
    () => (Object.keys(toDraft(null, defaults)) as DraftKey[]).filter((k) => isAdmin || !ADMIN_KEYS.includes(k)),
    [isAdmin, defaults],
  );
  const dirtyKeys = editableKeys.filter((k) => !same(draft[k], saved[k]));
  const dirty = dirtyKeys.length > 0;

  const endpoint = mode === "admin" && row ? `/api/team-profiles/${row.slug}` : "/api/me/employee-profile";
  const uploadSlug = mode === "admin" ? row?.slug : undefined;

  const set = <K extends DraftKey>(k: K, v: Draft[K]) => { setDraft((d) => ({ ...d, [k]: v })); setJustSaved(false); };

  /** PATCH the given keys (default: everything changed). Values come from `values` or the draft. */
  const save = useCallback(async (keys?: DraftKey[], values?: Partial<Draft>) => {
    const source = { ...draft, ...values };
    const list = keys ?? editableKeys.filter((k) => !same(source[k], saved[k]));
    if (!list.length) return true;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-sig-action-token": token },
        body: JSON.stringify({ patch: toPayload(source, list) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to save.");
      const next = data.profile as EmployeeProfile;
      const fresh = toDraft(next, defaults);
      setRow(next);
      setSaved(fresh);
      // Take the server's normalised values for the saved keys; keep other unsaved edits.
      setDraft((d) => {
        const merged = { ...d };
        for (const k of list) (merged as Record<string, unknown>)[k] = fresh[k];
        merged.full_name = fresh.full_name;
        return merged;
      });
      setJustSaved(true);
      if (mode === "admin" && row && next.slug !== row.slug) router.replace(`/dashboard/profile/${next.slug}`);
      else router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, saved, editableKeys, endpoint, token, defaults, mode, row, router]);

  // Ctrl/Cmd+S saves; warn before leaving with unsaved changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty && !saving) void save(); }
    };
    const onUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onUnload); };
  }, [dirty, saving, save]);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(t);
  }, [justSaved]);

  async function uploadPhoto(file: File) {
    setError(null);
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setPhotoBusy(true);
    setPhotoProgress(0);
    try {
      const url = await uploadImage(file, { kind: "photo", slug: uploadSlug, token, onProgress: setPhotoProgress });
      set("photo_url", url);
      await save(["photo_url"], { photo_url: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setPhotoBusy(false);
      setPhotoPreview(null);
      URL.revokeObjectURL(preview);
    }
  }

  async function removePhoto() {
    set("photo_url", "");
    await save(["photo_url"], { photo_url: "" });
  }

  async function addGalleryFiles(files: File[]) {
    setError(null);
    const items = files.slice(0, 20).map((f) => ({ file: f, p: { id: `${Date.now()}-${Math.random()}`, preview: URL.createObjectURL(f), progress: 0 } as Pending }));
    setPending((prev) => [...prev, ...items.map((i) => i.p)]);
    const uploaded: string[] = [];
    await Promise.all(items.map(async ({ file, p }) => {
      try {
        const url = await uploadImage(file, {
          kind: "gallery", slug: uploadSlug, token,
          onProgress: (pct) => setPending((prev) => prev.map((x) => (x.id === p.id ? { ...x, progress: pct } : x))),
        });
        uploaded.push(url);
        setPending((prev) => prev.filter((x) => x.id !== p.id));
        URL.revokeObjectURL(p.preview);
      } catch (e) {
        setPending((prev) => prev.map((x) => (x.id === p.id ? { ...x, error: e instanceof Error ? e.message : "Failed" } : x)));
        setTimeout(() => { setPending((prev) => prev.filter((x) => x.id !== p.id)); URL.revokeObjectURL(p.preview); }, 6000);
      }
    }));
    if (uploaded.length) {
      const next = [...draft.gallery_urls, ...uploaded];
      set("gallery_urls", next);
      await save(["gallery_urls"], { gallery_urls: next });
    }
  }

  async function changeGallery(next: string[]) {
    set("gallery_urls", next);
    await save(["gallery_urls"], { gallery_urls: next });
  }

  const name = draft.full_name || [draft.first_name, draft.last_name].filter(Boolean).join(" ") || defaults.email;
  const meter = completeness({
    ...draft,
    office: null,
    employment_date: draft.employment_date || null,
    start_time: draft.start_time || null,
    close_time: draft.close_time || null,
  } as unknown as Partial<EmployeeProfile>);
  const publicHref = row ? `/team/${row.slug}` : null;
  const photo = photoPreview || draft.photo_url;
  const scheduleLine = [formatWorkDays(draft.work_days), draft.start_time && draft.close_time ? `${formatTime(draft.start_time)} – ${formatTime(draft.close_time)}` : ""].filter(Boolean).join(" · ");

  const text = (k: DraftKey) => ({
    id: `ep-${k}`,
    value: draft[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
  });

  return (
    <div className="space-y-6 pb-32">
      {toolbar}

      {!row ? (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <span className="font-medium">Set up your team page.</span>{" "}
            <span className="text-muted-foreground">
              Fill in anything you like — nothing is required. Your page stays hidden from the website until you turn on <em>Show on website</em> in the Website tab.
            </span>
          </p>
        </div>
      ) : null}

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div
          className="h-24 sm:h-28"
          style={{ background: "linear-gradient(115deg, hsl(var(--brand-navy-deep)) 0%, hsl(var(--brand-navy)) 55%, hsl(var(--brand-gold) / 0.65) 130%)" }}
          aria-hidden
        />
        <CardContent className="-mt-16 p-5 sm:-mt-20 sm:p-6">
          <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_320px]">
            <PhotoDrop url={photo} name={name} busy={photoBusy} progress={photoProgress} onFile={uploadPhoto} onRemove={removePhoto} />

            <div className="min-w-0 space-y-4 md:pt-20">
              <div>
                <h2 className="break-words font-serif text-3xl leading-tight">{name}</h2>
                <p className="mt-1 text-muted-foreground">
                  {draft.job_title || <span className="italic">Add your job title</span>}
                  {draft.credentials ? <span className="font-medium text-gold">{` · ${draft.credentials}`}</span> : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {draft.office ? <Badge variant="outline" className="gap-1 font-medium"><MapPin className="h-3 w-3" /> {draft.office}</Badge> : null}
                <Badge variant="secondary" className="font-medium">{TEAM_GROUP_LABELS[draft.team_group as keyof typeof TEAM_GROUP_LABELS] ?? "Team"}</Badge>
                {row?.is_published ? (
                  <Badge className="gap-1 border-transparent bg-emerald-600/15 font-medium text-emerald-700 dark:text-emerald-300"><Eye className="h-3 w-3" /> On website</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 font-medium text-muted-foreground"><EyeOff className="h-3 w-3" /> Hidden</Badge>
                )}
                {scheduleLine ? <Badge variant="outline" className="gap-1 font-medium"><Clock className="h-3 w-3" /> {scheduleLine}</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {publicHref && row?.is_published ? (
                  <Button asChild size="sm">
                    <a href={publicHref} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View public page</a>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setTab("website")}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" /> {row ? "Publish on website" : "Website settings"}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4 md:col-span-2 xl:col-span-1 xl:pt-20">
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-4">
                  <CompletenessRing percent={meter.percent} />
                  <div className="min-w-0">
                    <p className="font-medium">{meter.percent >= 100 ? "Profile complete" : "Profile completeness"}</p>
                    <p className="text-sm text-muted-foreground">{meter.done} of {meter.total} details filled in</p>
                  </div>
                </div>
                {meter.missing.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {meter.missing.slice(0, 5).map((m) => (
                      <button key={m} type="button" onClick={() => setTab(FIELD_TAB[m] ?? "basics")}
                        className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
                        + {m}
                      </button>
                    ))}
                    {meter.missing.length > 5 ? <span className="px-1 text-[11px] text-muted-foreground">+{meter.missing.length - 5} more</span> : null}
                  </div>
                ) : null}
              </div>
              {account ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border p-4 text-sm xl:grid-cols-1">
                  <div className="col-span-2 min-w-0 xl:col-span-1"><dt className="text-xs text-muted-foreground">Signed in as</dt><dd className="break-all font-medium">{account.email}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Role</dt><dd className="font-medium">{account.roleLabel}</dd></div>
                  {account.memberSince ? <div><dt className="text-xs text-muted-foreground">Member since</dt><dd className="font-medium">{account.memberSince}</dd></div> : null}
                </dl>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Sections ────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 p-1 sm:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5 px-3 py-2">
              <t.icon className="h-4 w-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="basics">
          <SectionCard icon={UserRound} title="Basics" description="How your name and role appear on the website.">
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              <Field label="First name" htmlFor="ep-first_name"><Input {...text("first_name")} autoComplete="given-name" /></Field>
              <Field label="Last name" htmlFor="ep-last_name"><Input {...text("last_name")} autoComplete="family-name" /></Field>
              <Field label="Full name (as shown)" htmlFor="ep-full_name" hint="Leave blank to use first + last name. Nicknames welcome, e.g. Martha “MO” Cortez.">
                <Input {...text("full_name")} placeholder={[draft.first_name, draft.last_name].filter(Boolean).join(" ")} />
              </Field>
              <Field label="Job title" htmlFor="ep-job_title"><Input {...text("job_title")} placeholder="e.g. Client Service Associate" /></Field>
              <Field label="Credentials" htmlFor="ep-credentials" hint="Comma-separated, e.g. CFP®, CTFA®">
                <Input {...text("credentials")} placeholder="CFP®, CTFA®" />
              </Field>
              <Field label="Office">
                <FieldSelect
                  value={draft.office}
                  onChange={(v) => set("office", v)}
                  options={[{ value: "", label: "No office shown" }, ...OFFICES.map((o) => ({ value: o, label: o }))]}
                />
              </Field>
              <Field label="Date of employment" hint="When you joined SIG.">
                <DatePicker value={draft.employment_date} onChange={(v) => set("employment_date", v)} placeholder="Pick a date" />
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="about">
          <SectionCard
            icon={Sparkles}
            title="About me"
            description="The story on your team page. Write it like you'd say it to a client."
            action={
              <p className="max-w-xs text-xs text-muted-foreground">
                Tip: connect Claude or ChatGPT in Settings → AI Connectors and say “draft my ‘Why I love my job’ from these notes, then save it.”
              </p>
            }
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Professional experience & history" htmlFor="ep-experience" className="lg:col-span-2" count={draft.experience.length} max={8000}
                hint="Separate paragraphs with a blank line.">
                <Textarea {...text("experience")} rows={9} className="leading-relaxed" placeholder="Where you've worked, what you specialise in, designations, where you grew up…" />
              </Field>
              <Field label="Who inspires you?" htmlFor="ep-inspires" count={draft.inspires.length} max={2000}>
                <Textarea {...text("inspires")} rows={4} />
              </Field>
              <Field label="Favorite hobbies" htmlFor="ep-hobbies" count={draft.hobbies.length} max={2000}>
                <Textarea {...text("hobbies")} rows={4} />
              </Field>
              <Field label="Best purchase under $100" htmlFor="ep-best_purchase" count={draft.best_purchase.length} max={1000}>
                <Textarea {...text("best_purchase")} rows={3} placeholder="The little thing that made a big difference…" />
              </Field>
              <Field label="Favorite destination" htmlFor="ep-favorite_destination" count={draft.favorite_destination.length} max={2000}>
                <Textarea {...text("favorite_destination")} rows={3} />
              </Field>
              <Field label="Why I love my job" htmlFor="ep-why_love_job" count={draft.why_love_job.length} max={3000}>
                <Textarea {...text("why_love_job")} rows={4} />
              </Field>
              <Field label="Favorite quote" htmlFor="ep-favorite_quote" count={draft.favorite_quote.length} max={1000} hint="Include the author, e.g. “…” – Maya Angelou">
                <Textarea {...text("favorite_quote")} rows={4} />
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="contact">
          <SectionCard icon={Mail} title="Contact" description="Shown on your public page. Leave blank to show the main SIG line and email instead.">
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              <Field label="Phone number" htmlFor="ep-phone" hint="Also updates the phone on your dashboard account.">
                <div className="relative"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input {...text("phone")} type="tel" autoComplete="tel" className="pl-9" placeholder="(480) 466-7070" /></div>
              </Field>
              <Field label="Email address" htmlFor="ep-email">
                <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input {...text("email")} type="email" autoComplete="email" className="pl-9" placeholder={defaults.email || "name@strategicincomegroup.com"} /></div>
              </Field>
              <Field label="LinkedIn profile URL" htmlFor="ep-linkedin_url">
                <div className="relative"><Linkedin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input {...text("linkedin_url")} type="url" className="pl-9" placeholder="linkedin.com/in/your-name" /></div>
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="schedule">
          <SectionCard icon={CalendarDays} title="Work schedule" description="Let clients know when you're in.">
            <div className="space-y-6">
              <Field label="Work days">
                <div className="flex flex-wrap gap-2">
                  {WORK_DAYS.map((d) => {
                    const on = draft.work_days.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("work_days", on ? draft.work_days.filter((x) => x !== d.key) : WORK_DAYS.map((w) => w.key as string).filter((k) => k === d.key || draft.work_days.includes(k)))}
                        className={cn(
                          "inline-flex h-10 min-w-[3.5rem] items-center justify-center gap-1 rounded-full border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          on ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {on ? <Check className="h-3.5 w-3.5" /> : null}{d.short}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <button type="button" className="text-primary hover:underline" onClick={() => set("work_days", ["mon", "tue", "wed", "thu", "fri"])}>Mon–Fri</button>
                  <span className="text-muted-foreground">·</span>
                  <button type="button" className="text-muted-foreground hover:text-foreground hover:underline" onClick={() => set("work_days", [])}>Clear</button>
                </div>
              </Field>
              <div className="grid max-w-xl gap-5 sm:grid-cols-2">
                <Field label="Start time"><TimePicker value={draft.start_time} onChange={(v) => set("start_time", v)} placeholder="e.g. 8:00 AM" /></Field>
                <Field label="Close time"><TimePicker value={draft.close_time} onChange={(v) => set("close_time", v)} placeholder="e.g. 5:00 PM" /></Field>
              </div>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                {scheduleLine ? <span><span className="text-muted-foreground">On your page:</span> <span className="font-medium">{scheduleLine}</span></span> : <span className="text-muted-foreground">No schedule shown on your page yet.</span>}
                {draft.start_time || draft.close_time ? (
                  <button type="button" className="ml-auto text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => { set("start_time", ""); set("close_time", ""); }}>
                    Clear times
                  </button>
                ) : null}
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="gallery">
          <SectionCard icon={Images} title="Photo gallery" description="Family, hobbies, travel, team moments. Changes here save right away."
            action={<span className="text-xs text-muted-foreground">{draft.gallery_urls.length} photo{draft.gallery_urls.length === 1 ? "" : "s"}</span>}>
            <Gallery urls={draft.gallery_urls} pending={pending} onFiles={addGalleryFiles} onChange={changeGallery} busy={saving} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="website">
          <SectionCard icon={Eye} title="Website" description="Control how your page appears on strategicincomegroup.com.">
            <div className="space-y-6">
              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-4">
                <span>
                  <span className="block font-medium">Show on website</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">Lists you on Our Team and makes your page public.</span>
                </span>
                <Switch checked={draft.is_published} onCheckedChange={(v) => set("is_published", v)} />
              </label>
              <Field label="Page address" htmlFor="ep-slug" hint={isAdmin ? "Changing this changes the public URL — old links will stop working." : "Ask an admin if this needs to change."}>
                <div className="flex min-w-0 items-stretch overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring">
                  <span className="hidden items-center gap-1 border-r bg-muted px-3 text-sm text-muted-foreground sm:flex"><Link2 className="h-3.5 w-3.5" /> strategicincomegroup.com/team/</span>
                  <Input {...text("slug")} disabled={!isAdmin} placeholder={row ? "" : "set when you first save"} className="min-w-0 rounded-none border-0 shadow-none focus-visible:ring-0" />
                </div>
              </Field>
              {isAdmin ? (
                <div className="grid gap-5 border-t pt-6 md:grid-cols-2 2xl:grid-cols-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:col-span-2 2xl:col-span-4">Admin settings</p>
                  <Field label="Team section"><FieldSelect value={draft.team_group} onChange={(v) => set("team_group", v)} options={TEAM_GROUPS.map((g) => ({ value: g, label: TEAM_GROUP_LABELS[g] }))} /></Field>
                  <Field label="Sort order" htmlFor="ep-sort_order" hint="Lower numbers appear first."><Input {...text("sort_order")} type="number" inputMode="numeric" /></Field>
                  <Field label="Booking link" htmlFor="ep-booking_href" hint="Planners: /book?planner=<slug>"><Input {...text("booking_href")} placeholder="/book?planner=jane-doe" /></Field>
                  <Field label="Linked account email" htmlFor="ep-account_email" hint={row?.profile_id ? "Linked to a dashboard user." : "Links automatically when this person signs in."}>
                    <Input {...text("account_email")} type="email" placeholder="name@strategicincomegroup.com" />
                  </Field>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* ── Sticky save bar ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 transition-all duration-300 md:bottom-6",
          dirty || error || justSaved || saving ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        )}
        aria-live="polite"
      >
        <div className="pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-2xl border bg-background/95 px-4 py-3 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            {error ? (
              <><AlertCircle className="h-4 w-4 shrink-0 text-destructive" /><span className="text-destructive">{error}</span></>
            ) : saving ? (
              <><Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" /><span>Saving…</span></>
            ) : dirty ? (
              <><span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" /><span>{dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? "" : "s"}</span><span className="hidden text-xs text-muted-foreground sm:inline">· Ctrl/⌘ S</span></>
            ) : (
              <><Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span>All changes saved</span></>
            )}
          </div>
          {error && !dirty ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setError(null)}><X className="h-4 w-4" /></Button>
          ) : null}
          {dirty ? (
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => { setDraft(saved); setError(null); }}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Discard
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
                <Save className="mr-1.5 h-3.5 w-3.5" /> {row ? "Save changes" : "Create my page"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
