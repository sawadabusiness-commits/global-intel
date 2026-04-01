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
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const progressKey = `progress:${today}`;

  try {
    // 処理済みテーマインデックスを取得（単純なnumber）
    const doneIndex = (await kv.get<number>(progressKey)) ?? 0;

    if (doneIndex >= THEME_IDS.length) {
      return NextResponse.json({ ok: true, message: "All themes done", done: doneIndex });
    }

    const themeId = THEME_IDS[doneIndex];

    // 次のインデックスを先に保存（失敗してもスキップして次へ進む）
    await kv.set(progressKey, doneIndex + 1, { ex: 86400 });

    // ニュース取得
    const articles = await fetchNewsByTheme(themeId as ThemeId);
    const article = pickBestArticle(articles);

    if (!article) {
      return NextResponse.json({
        ok: true,
        theme: themeId,
        message: "No suitable articles",
        remaining: THEME_IDS.length - doneIndex - 1,
      });
    }

    // Gemini分析
    const analysis = await analyzeArticle(article);
    if (!analysis) {
      return NextResponse.json({
        ok: true,
        theme: themeId,
        message: "Analysis failed",
        remaining: THEME_IDS.length - doneIndex - 1,
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

    return NextResponse.json({
      ok: true,
      theme: themeId,
      date: today,
      title: analysis.title_ja,
      total: combined.length,
      remaining: THEME_IDS.length - doneIndex - 1,
    });
  } catch (e) {
    console.error("Cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
