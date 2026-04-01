import { NextRequest, NextResponse } from "next/server";
import { fetchNewsByTheme } from "@/lib/newsdata";
import { analyzeArticle } from "@/lib/gemini";
import { saveArticles, getArticles, setLatestDate } from "@/lib/kv";
import type { AnalyzedArticle, NewsDataArticle, ThemeId } from "@/lib/types";
import { THEMES } from "@/lib/themes";
import { kv } from "@vercel/kv";

export const maxDuration = 60;

const THEME_IDS = THEMES.map((t) => t.id);

function pickBestArticle(articles: NewsDataArticle[]): NewsDataArticle | null {
  const sorted = articles
    .filter((a) => a.description && a.description.length > 50)
    .sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0));
  return sorted[0] ?? null;
}

export async function GET(req: NextRequest) {
  const start = Date.now();
  const timings: Record<string, number> = {};

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  timings.auth = Date.now() - start;

  const today = new Date().toISOString().split("T")[0];
  const progressKey = `progress:${today}`;

  try {
    const t1 = Date.now();
    const doneIndex = (await kv.get<number>(progressKey)) ?? 0;
    timings.kv_get_progress = Date.now() - t1;

    if (doneIndex >= THEME_IDS.length) {
      return NextResponse.json({ ok: true, message: "All themes done", done: doneIndex, timings });
    }

    const themeId = THEME_IDS[doneIndex];

    const t2 = Date.now();
    await kv.set(progressKey, doneIndex + 1, { ex: 86400 });
    timings.kv_set_progress = Date.now() - t2;

    const t3 = Date.now();
    const articles = await fetchNewsByTheme(themeId as ThemeId);
    timings.fetch_news = Date.now() - t3;

    const article = pickBestArticle(articles);
    if (!article) {
      timings.total = Date.now() - start;
      return NextResponse.json({
        ok: true, theme: themeId, message: "No suitable articles", timings,
      });
    }

    const t4 = Date.now();
    const analysis = await analyzeArticle(article);
    timings.gemini_analysis = Date.now() - t4;

    if (!analysis) {
      timings.total = Date.now() - start;
      return NextResponse.json({
        ok: true, theme: themeId, message: "Analysis failed", timings,
      });
    }

    const analyzed: AnalyzedArticle = {
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
    };

    const t5 = Date.now();
    const existing = await getArticles(today);
    timings.kv_get_articles = Date.now() - t5;

    const combined = [...existing, analyzed];

    const t6 = Date.now();
    await saveArticles(today, combined);
    await setLatestDate(today);
    timings.kv_save = Date.now() - t6;

    timings.total = Date.now() - start;

    return NextResponse.json({
      ok: true,
      theme: themeId,
      date: today,
      title: analysis.title_ja,
      total: combined.length,
      remaining: THEME_IDS.length - doneIndex - 1,
      timings,
    });
  } catch (e) {
    timings.total = Date.now() - start;
    return NextResponse.json({ error: String(e), timings }, { status: 500 });
  }
}
