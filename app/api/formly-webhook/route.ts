import { NextResponse } from "next/server";

const BREVO_API = "https://api.brevo.com/v3";
const MOUSE_LIST_ID = 5;

type BrevoAttrs = Record<string, string | number>;

function normalizePhone(p: string | undefined | null): string {
  if (!p) return "";
  const d = p.replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  return `+${d}`;
}

/**
 * Formly sends a variety of payload shapes. We try common patterns so the
 * handler keeps working if Formly tweaks their schema. The first successful
 * run logs the raw payload so we can pin down the exact shape.
 */
function extractFields(body: unknown): {
  email: string;
  attrs: BrevoAttrs;
  phone: string;
  rawMatched: boolean;
} {
  const attrs: BrevoAttrs = { SOURCE: "formly-coachmouse-form" };
  let email = "";
  let phone = "";
  let rawMatched = false;

  const pick = (obj: Record<string, unknown>, keys: string[]): string => {
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return "";
  };

  const scanAnswersArray = (answers: Array<Record<string, unknown>>) => {
    for (const a of answers) {
      const label = String(
        (a.label ?? a.question ?? a.title ?? (a.field as Record<string, unknown> | undefined)?.label ?? "") as string
      ).toLowerCase();
      const value =
        typeof a.value === "string"
          ? a.value
          : typeof a.answer === "string"
            ? a.answer
            : Array.isArray(a.value)
              ? (a.value as unknown[]).map(String).join(", ")
              : "";
      if (!label || !value) continue;
      if (label.includes("email")) email = value;
      else if (label.includes("phone")) phone = value;
      else if (label.includes("first name")) attrs.FIRSTNAME = value;
      else if (label.includes("last name")) attrs.LASTNAME = value;
      else if (label === "age" || label.includes(" age")) {
        const n = Number(value);
        if (!Number.isNaN(n)) attrs.AGE = n;
      } else if (label.includes("city")) attrs.CITY = value;
      else if (label.includes("best describes") || label.includes("relation")) attrs.RELATION = value;
      else if (label.includes("graduate") || label.includes("grad year")) {
        const n = Number(value);
        if (!Number.isNaN(n)) attrs.GRAD_YEAR = n;
      } else if (label.includes("story")) attrs.STORY_TEXT = value;
      else if (label.includes("archival") || label.includes("footage")) attrs.ARCHIVAL = value;
      else if (label.includes("considered") || label.includes("interview")) attrs.INTERVIEW_INTEREST = value;
    }
  };

  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    // Shape A: flat object with named keys
    email = pick(obj, ["Email Address", "email", "Email"]) || email;
    phone = pick(obj, ["Phone Number", "phone", "Phone"]) || phone;
    const first = pick(obj, ["First Name", "firstName", "first_name"]);
    const last = pick(obj, ["Last Name", "lastName", "last_name"]);
    if (first) attrs.FIRSTNAME = first;
    if (last) attrs.LASTNAME = last;
    const relation = pick(obj, ["Which best describes you?", "relation", "Relation"]);
    if (relation) attrs.RELATION = relation;
    const city = pick(obj, ["Current City, State", "city", "City"]);
    if (city) attrs.CITY = city;
    const gradStr = pick(obj, ["What year did you graduate High School?", "gradYear", "grad_year"]);
    if (gradStr && !Number.isNaN(Number(gradStr))) attrs.GRAD_YEAR = Number(gradStr);
    const ageStr = pick(obj, ["Age", "age"]);
    if (ageStr && !Number.isNaN(Number(ageStr))) attrs.AGE = Number(ageStr);
    const story = pick(obj, ["Do you have a story to share? Type it here.", "story", "Story"]);
    if (story) attrs.STORY_TEXT = story;
    const archival = pick(obj, ["Do you have archival footage to share?", "archival"]);
    if (archival) attrs.ARCHIVAL = archival;
    const interview = pick(obj, ["Want to be considered for an interview?", "interview"]);
    if (interview) attrs.INTERVIEW_INTEREST = interview;
    if (email || attrs.FIRSTNAME) rawMatched = true;

    // Shape B: { data: {...} } or { submission: {...} } or { payload: {...} }
    for (const key of ["data", "submission", "payload", "response", "formResponse"]) {
      const inner = obj[key];
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        const nested = extractFields(inner);
        if (nested.email) email = nested.email;
        if (nested.phone) phone = nested.phone;
        Object.assign(attrs, nested.attrs);
        if (nested.rawMatched) rawMatched = true;
      }
    }

    // Shape C: answers as array (Typeform-style)
    for (const key of ["answers", "fields", "questions"]) {
      const arr = obj[key];
      if (Array.isArray(arr)) {
        scanAnswersArray(arr as Array<Record<string, unknown>>);
        rawMatched = true;
      }
    }
  }

  return { email, attrs, phone, rawMatched };
}

export async function POST(request: Request) {
  const expectedSecret = process.env.FORMLY_WEBHOOK_SECRET;
  const brevoKey = process.env.BREVO_API_KEY;

  if (!brevoKey) {
    console.error("[formly-webhook] BREVO_API_KEY not configured");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  if (expectedSecret) {
    const header = request.headers.get("x-webhook-secret");
    const url = new URL(request.url);
    const query = url.searchParams.get("secret");
    if (header !== expectedSecret && query !== expectedSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  console.log("[formly-webhook] raw payload:", JSON.stringify(body));

  const { email, attrs, phone } = extractFields(body);
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) attrs.SMS = normalizedPhone;

  if (!email) {
    console.error("[formly-webhook] no email found in payload");
    return NextResponse.json({ ok: true, warning: "no email in payload" }, { status: 200 });
  }

  const payload = {
    email: email.toLowerCase(),
    attributes: attrs,
    listIds: [MOUSE_LIST_ID],
    updateEnabled: true,
  };

  const brevoRes = await fetch(`${BREVO_API}/contacts`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": brevoKey,
    },
    body: JSON.stringify(payload),
  });

  if (!brevoRes.ok) {
    const text = await brevoRes.text();
    console.error(`[formly-webhook] Brevo error ${brevoRes.status}:`, text);
    return NextResponse.json(
      { ok: true, warning: "upstream error", status: brevoRes.status },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, email: payload.email }, { status: 200 });
}
