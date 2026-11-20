import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formTypeLabel } from "@/lib/forms/types";

// Public website forms: contact, newsletter sign-up and career interest.
// Submissions land in form_submissions for the dashboard's Form Submissions inbox.

const FORM_TYPES = new Set(["contact", "newsletter", "new_client", "client_service", "church_403b", "investment_committee", "career_interest"]);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real visitors never see or fill this field.
  if (clip(body.company_website, 200)) return NextResponse.json({ ok: true });

  const formType = clip(body.formType, 40);
  if (!FORM_TYPES.has(formType)) return NextResponse.json({ error: "Unknown form." }, { status: 400 });

  const email = clip(body.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });

  const payload = {
    firstName: clip(body.firstName, 80),
    lastName: clip(body.lastName, 80),
    email,
    phone: clip(body.phone, 40),
    office: clip(body.office, 80),
    topic: clip(body.topic, 120),
    message: clip(body.message, 5000),
    consent: body.consent === true,
    // Option-specific answers from the contact page (planner, request type, church size, position…).
    details: Object.fromEntries(
      Object.entries(typeof body.details === "object" && body.details ? (body.details as Record<string, unknown>) : {})
        .slice(0, 20)
        .map(([k, v]) => [clip(k, 40), clip(v, 500)]),
    ),
  };

  if (formType === "newsletter" && !payload.consent) {
    return NextResponse.json({ error: "Please check the consent box to subscribe." }, { status: 400 });
  }
  if (formType === "contact" && (!payload.firstName || !payload.message)) {
    return NextResponse.json({ error: "Please include your name and a message." }, { status: 400 });
  }
  if (formType !== "newsletter" && formType !== "contact" && !payload.firstName) {
    return NextResponse.json({ error: "Please include your name." }, { status: 400 });
  }
  if ((formType === "client_service" || formType === "career_interest" || formType === "investment_committee") && !payload.message) {
    return NextResponse.json({ error: "Please add a few details in the message." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("form_submissions").insert({
      form_type: formType,
      email,
      subject: `${formTypeLabel(formType)}${payload.firstName ? ` — ${[payload.firstName, payload.lastName].filter(Boolean).join(" ")}` : ""}`.slice(0, 200),
      message: payload.message || null,
      phone: payload.phone || null,
      source: clip(body.source, 200) || "website",
      payload,
      metadata: {
        user_agent: request.headers.get("user-agent"),
        ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
        consent_text: formType === "newsletter" ? clip(body.consentText, 1000) : undefined,
      },
    });
    if (error) throw error;
  } catch (error) {
    console.error("[public forms] insert failed", error);
    return NextResponse.json({ error: "We couldn't send that just now. Please call (480) 466-7070." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
