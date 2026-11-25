"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Headphones, Loader2, MessageSquareText, ShieldAlert, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FieldSelect } from "@/components/ui/field-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";

type Settings = {
  autoTranscribe: boolean;
  voiceConferenceMode: boolean;
  smsMessagesPerSecond: number;
  smsKeywordReplies: boolean;
  updatedAt: string | null;
  available: boolean;
};

type Payload = {
  settings: Settings;
  canEdit: boolean;
  sender: { messagingService: boolean; phoneNumber: string };
  signatureBypassed: boolean;
  webhooks: Record<string, string> | null;
};

const RATE_OPTIONS = ["0.5", "1", "2", "5", "10"].map((v) => ({ value: v, label: `${v} message${v === "1" ? "" : "s"} / second` }));

export function DialerSettings({ onChange }: { onChange?: (s: Settings) => void }) {
  const actionToken = useDashboardActionToken();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmConference, setConfirmConference] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/voice/settings", { headers: { "x-sig-action-token": actionToken } });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setData(json);
    else setError(json.error ?? "Could not load settings.");
  }, [actionToken]);

  useEffect(() => { load(); }, [load]);

  async function save(key: keyof Settings, value: boolean | number) {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/voice/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionToken, [key]: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not save.");
      setData((d) => (d ? { ...d, settings: json.settings } : d));
      onChange?.(json.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(null);
    }
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          {error ? <span className="text-destructive">{error}</span> : <><Loader2 className="h-4 w-4 animate-spin" /> Loading settings…</>}
        </CardContent>
      </Card>
    );
  }

  const { settings, canEdit } = data;
  const disabled = !canEdit || !settings.available;

  return (
    <div className="space-y-4">
      {!settings.available ? (
        <Notice tone="warn" title="Run the communications migration">
          Apply <code className="font-mono text-xs">supabase/migrations/202611250230_communications.sql</code> in Supabase to save these settings.
          Until then auto-transcribe and Conference mode stay off and calls use the original flow.
        </Notice>
      ) : null}
      {!canEdit ? <Notice tone="info" title="Super Admin only">You can see these settings; only a Super Admin can change them.</Notice> : null}
      {data.signatureBypassed ? (
        <Notice tone="warn" title="Twilio signature check is OFF">
          <code className="font-mono text-xs">TWILIO_SKIP_SIGNATURE</code> is set, so unsigned requests to the Twilio webhooks are accepted. Remove it in Coolify once calls and texts work.
        </Notice>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calls</CardTitle>
          <CardDescription>How recordings and live calls are handled.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y p-0">
          <Row
            icon={Sparkles}
            title="Auto-transcribe recordings"
            description="Transcribe every call recording and voicemail with OpenAI as soon as Twilio delivers it. Uses the OpenAI key on the Credentials page."
          >
            <Switch checked={settings.autoTranscribe} disabled={disabled || saving === "autoTranscribe"} onCheckedChange={(v) => save("autoTranscribe", v)} aria-label="Auto-transcribe recordings" />
          </Row>
          <Row
            icon={Headphones}
            title="Conference mode (call monitoring)"
            description="Routes every inbound and outbound call through a Twilio Conference so admins can listen, whisper or barge. Off keeps the original call flow."
            badge={settings.voiceConferenceMode ? <Badge className="text-[10px]">On</Badge> : <Badge variant="outline" className="text-[10px]">Off</Badge>}
          >
            <Switch
              checked={settings.voiceConferenceMode}
              disabled={disabled || saving === "voiceConferenceMode"}
              onCheckedChange={(v) => setConfirmConference(v)}
              aria-label="Conference mode"
            />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Texts</CardTitle>
          <CardDescription>
            Bulk sends go out {data.sender.messagingService ? "through your Messaging Service (A2P 10DLC)" : `from ${data.sender.phoneNumber} — add a Messaging Service SID on the Credentials page for A2P campaigns`}.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y p-0">
          <Row icon={MessageSquareText} title="Bulk send speed" description="How fast campaigns send. 1 per second is safe for a single 10DLC number; raise it only if your campaign's throughput allows.">
            <FieldSelect
              value={String(settings.smsMessagesPerSecond)}
              onChange={(v) => save("smsMessagesPerSecond", Number(v))}
              options={RATE_OPTIONS.some((o) => o.value === String(settings.smsMessagesPerSecond)) ? RATE_OPTIONS : [...RATE_OPTIONS, { value: String(settings.smsMessagesPerSecond), label: `${settings.smsMessagesPerSecond} / second` }]}
              disabled={disabled || saving === "smsMessagesPerSecond"}
              className="w-[190px]"
              aria-label="Bulk send speed"
            />
          </Row>
          <Row
            icon={ShieldAlert}
            title="Reply to STOP / START / HELP"
            description="Send the standard confirmation text. Turn off if Advanced Opt-Out on the Messaging Service already replies (opt-outs are recorded either way)."
          >
            <Switch checked={settings.smsKeywordReplies} disabled={disabled || saving === "smsKeywordReplies"} onCheckedChange={(v) => save("smsKeywordReplies", v)} aria-label="Keyword replies" />
          </Row>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Dialog open={confirmConference !== null} onOpenChange={(o) => !o && setConfirmConference(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmConference ? "Turn on Conference mode?" : "Turn off Conference mode?"}</DialogTitle>
            <DialogDescription>
              {confirmConference
                ? "Every new call — inbound and outbound — will be placed in a Twilio Conference. Callers hear hold music until the softphone answers, and unanswered calls still go to voicemail. Test it on a test number first; calls already in progress aren't affected."
                : "New calls go back to the original direct-dial flow. Live calls stay in their conference until they end, but can no longer be monitored."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmConference(null)}>Cancel</Button>
            <Button
              onClick={() => {
                const v = Boolean(confirmConference);
                setConfirmConference(null);
                save("voiceConferenceMode", v);
              }}
            >
              {confirmConference ? "Turn on" : "Turn off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ icon: Icon, title, description, badge, children }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">{title} {badge}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0 pl-11 sm:pl-0">{children}</div>
    </div>
  );
}

function Notice({ tone, title, children }: { tone: "warn" | "info"; title: string; children: React.ReactNode }) {
  return (
    <div className={`flex gap-3 rounded-lg border p-3 text-sm ${tone === "warn" ? "border-amber-500/40 bg-amber-500/10" : "bg-muted/50"}`}>
      <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
