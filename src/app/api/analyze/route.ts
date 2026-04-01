import { NextRequest, NextResponse } from "next/server";
import { analyzeArticle } from "@/lib/gemini";
import type { NewsDataArticle } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const article: NewsDataArticle = await req.json();
    const analysis = await analyzeArticle(article);
    if (!analysis) {
      return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }
    return NextResponse.json(analysis);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
