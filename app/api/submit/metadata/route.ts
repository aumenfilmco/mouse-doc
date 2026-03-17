import { NextResponse } from "next/server";
import { validateSubmission } from "@/app/utils/validateSubmission";

export async function POST(request: Request) {
  let body: {
    name?: string;
    relation?: string;
    email?: string;
    phone?: string;
    textStory?: string;
    fileKey?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    name = "",
    relation = "",
    email = "",
    phone = "",
    textStory = "",
    fileKey = "",
  } = body;

  // Server-side validation (defense-in-depth)
  const validation = validateSubmission({
    name,
    relation,
    email,
    phone,
    textStory,
    hasFile: fileKey.length > 0,
  });

  if (!validation.valid) {
    // Return first error
    const firstError = Object.values(validation.errors)[0];
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const res = await fetch(
    `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              Name: name,
              Connection: relation,
              Email: email || "",
              Phone: phone || "",
              StoryText: textStory || "",
              FileKey: fileKey || "",
              SubmittedAt: new Date().toISOString(),
            },
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Airtable write failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
