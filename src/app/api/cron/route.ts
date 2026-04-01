import { NextRequest, NextResponse } from "next/server";
import { fetchNewsByTheme } from "@/lib/newsdata";
import { analyzeArticle } from "@/lib/gemini";
import { saveArticles, getArticles, setLatestDate } from "@/lib/kv";
import type { AnalyzedArticle, NewsDataArticle, ThemeId } from "@/lib/types";
import { THEMES } from "@/lib/themes";
import { kv } from "@vercel/kv";

export const maxDuration = 60;

function pickBestArticle(articles: NewsDataArticle[]): NewsDataArticle | null {
  const sorted = articles
    .filter((a) => a.description && a.description.length > 50)
    .sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0));
  return sorted[0] ?? null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const progressKey = `progress:${today}`;

  try {
    // 今日処理済みのテーマを取得
    const done = await kv.smembers(progressKey) as string[];
    const doneSet = new Set(done);

    // 未処理のテーマを探す
    const nextTheme = THEMES.find((t) => !doneSet.has(t.id));
    if (!nextTheme) {
      return NextResponse.json({ ok: true, message: "All themes done", done: done.length });
    }

    // ニュース取得
    const articles = await fetchNewsByTheme(nextTheme.id as ThemeId);
    const article = pickBestArticle(articles);

    if (!article) {
      // 記事がなくても処理済みにする
      await kv.sadd(progressKey, nextTheme.id);
      await kv.expire(progressKey, 86400);
      return NextResponse.json({
        ok: true,
        theme: nextTheme.id,
        message: "No suitable articles",
        remaining: THEMES.length - doneSet.size - 1,
      });
    }

    // Gemini分析
    const analysis = await analyzeArticle(article);
    if (!analysis) {
      await kv.sadd(progressKey, nextTheme.id);
      await kv.expire(progressKey, 86400);
      return NextResponse.json({
        ok: true,
        theme: nextTheme.id,
        message: "Analysis failed",
        remaining: THEMES.length - doneSet.size - 1,
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

    // 既存データに追記
    const existing = await getArticles(today);
    const combined = [...existing, analyzed];
    await saveArticles(today, combined);
    await setLatestDate(today);

    // 処理済みマーク
    await kv.sadd(progressKey, nextTheme.id);
    await kv.expire(progressKey, 86400);

    return NextResponse.json({
      ok: true,
      theme: nextTheme.id,
      date: today,
      title: analysis.title_ja,
      total: combined.length,
      remaining: THEMES.length - doneSet.size - 1,
    });
  } catch (e) {
    console.error("Cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
