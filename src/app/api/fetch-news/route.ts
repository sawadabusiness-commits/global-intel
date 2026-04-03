import { NextResponse } from "next/server";
import { fetchAllThemes, deduplicateArticles } from "@/lib/newsdata";

export const maxDuration = 30;

export async function GET() {
  try {
    const results = await fetchAllThemes();
    const all = results.flatMap((r) => r.articles);
    const unique = deduplicateArticles(all);

    return NextResponse.json({
      total: unique.length,
      by_theme: results.map((r) => ({
        theme: r.themeId,
        count: r.articles.length,
      })),
      articles: unique,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
