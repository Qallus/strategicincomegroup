"use client";

import * as React from "react";
import { Loader2, Megaphone } from "lucide-react";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { Button } from "@/components/ui/button";
import { FieldSelect } from "@/components/ui/field-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "./responsive-panel";

const AUDIENCE = [
  { value: "everyone", label: "Everyone" },
  { value: "staff", label: "Staff only" },
  { value: "admins", label: "Admins only" },
];

/** Super admin "Post update" for the What's new row. */
export function PostUpdateDialog({ open, onOpenChange, onPosted }: { open: boolean; onOpenChange: (v: boolean) => void; onPosted: () => void }) {
  const token = useDashboardActionToken();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [link, setLink] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [audience, setAudience] = React.useState("everyone");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => { setTitle(""); setBody(""); setLink(""); setImageUrl(""); setAudience("everyone"); setError(null); };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/whats-new", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sig-action-token": token },
        body: JSON.stringify({ title, body, link, imageUrl, audience, actionToken: token }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Couldn't post the update.");
      reset();
      onPosted();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't post the update.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(v) => { if (!v) setError(null); onOpenChange(v); }}
      title="Post an update"
      description="Shows in everyone's What's new row. People can hide it once they've read it."
      className="sm:max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          {error ? <p className="mr-auto text-xs text-destructive" role="alert">{error}</p> : null}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy || !title.trim()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />} Post update
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="wn-title">Title</Label>
          <Input id="wn-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="New: bulk texting is live" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wn-body">Details</Label>
          <Textarea id="wn-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={5} placeholder="What changed and why it matters." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wn-link">Link (optional)</Label>
            <Input id="wn-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/dashboard/sms" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wn-aud">Audience</Label>
            <FieldSelect id="wn-aud" value={audience} onChange={setAudience} options={AUDIENCE} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wn-img">Image URL (optional)</Label>
          <Input id="wn-img" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
