import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say hello in JSON format: {\"message\": \"hello\"}" }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 100,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const status = res.status;
    const body = await res.text();
    return NextResponse.json({ status, body: body.slice(0, 1000) });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
