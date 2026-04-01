import { NextResponse } from "next/server";
import { fetchAllThemes, deduplicateArticles } from "@/lib/newsdata";
import { analyzeArticle } from "@/lib/gemini";
import { saveArticles, setLatestDate } from "@/lib/kv";
import type { AnalyzedArticle, NewsDataArticle } from "@/lib/types";

export const maxDuration = 60;

function pickBestPerTheme(
  themeResults: { themeId: string; articles: NewsDataArticle[] }[]
): NewsDataArticle[] {
  const picked: NewsDataArticle[] = [];
  const seen = new Set<string>();

  for (const { articles } of themeResults) {
    const sorted = [...articles]
      .filter((a) => a.description && a.description.length > 50)
      .sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0));

    for (const a of sorted) {
      if (!seen.has(a.article_id)) {
        seen.add(a.article_id);
        picked.push(a);
        break;
      }
    }
  }
  return picked;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    const themeResults = await fetchAllThemes();
    const allArticles: NewsDataArticle[] = [];
    for (const r of themeResults) {
      allArticles.push(...r.articles);
    }
    const unique = deduplicateArticles(allArticles);

    if (unique.length === 0) {
      return NextResponse.json({ ok: true, message: "No articles found" });
    }

    // テーマごとに1本ずつ選ぶ（最大10本）
    const picked = pickBestPerTheme(themeResults);

    const analyzed: AnalyzedArticle[] = [];
    for (const article of picked) {
      if (analyzed.length > 0) {
        await new Promise((r) => setTimeout(r, 8000));
      }

      const analysis = await analyzeArticle(article);
      if (!analysis) continue;

      analyzed.push({
        id: article.article_id,
        title_en: article.title,
        title_ja: analysis.title_ja,
        summary_ja: analysis.summary_ja,
        source: article.source_name,
        url: article.link,
        region: (article.country ?? []).join(", "),
        published: article.pubDate,
        read_time: 3,
        primary_theme: analysis.primary_theme,
        cross_themes: analysis.cross_themes,
        impact: analysis.impact,
        timeframe: analysis.timeframe,
        analysis,
        created_at: new Date().toISOString(),
      });
    }

    if (analyzed.length > 0) {
      await saveArticles(today, analyzed);
      await setLatestDate(today);
    }

    return NextResponse.json({
      ok: true,
      date: today,
      fetched: unique.length,
      picked: picked.length,
      analyzed: analyzed.length,
    });
  } catch (e) {
    console.error("Cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
