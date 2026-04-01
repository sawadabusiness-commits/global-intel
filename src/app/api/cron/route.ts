import { NextRequest, NextResponse } from "next/server";
import { fetchNewsByTheme } from "@/lib/newsdata";
import { analyzeArticle } from "@/lib/gemini";
import { saveArticles, getArticles, setLatestDate } from "@/lib/kv";
import type { AnalyzedArticle, NewsDataArticle } from "@/lib/types";
import { THEMES } from "@/lib/themes";
import { kv } from "@vercel/kv";

export const maxDuration = 60;

// 3バッチに分割: 4テーマ / 3テーマ / 3テーマ
const BATCH_THEMES: Record<string, string[]> = {
  "1": ["geopolitics", "tech_society", "economic_policy", "emerging_markets"],
  "2": ["crime_drugs", "demographics", "energy_resources"],
  "3": ["financial_system", "food_supply", "space_cyber"],
};

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

  const batch = req.nextUrl.searchParams.get("batch") ?? "1";
  const today = new Date().toISOString().split("T")[0];
  const themeIds = BATCH_THEMES[batch] ?? BATCH_THEMES["1"];

  try {
    // このバッチ担当テーマのニュースを取得
    const picked: NewsDataArticle[] = [];
    for (let i = 0; i < themeIds.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1000));
      const articles = await fetchNewsByTheme(themeIds[i] as any);
      const best = pickBestArticle(articles);
      if (best) picked.push(best);
    }

    if (picked.length === 0) {
      return NextResponse.json({ ok: true, batch, message: "No articles found" });
    }

    // 各記事をGemini分析（2秒間隔）
    const analyzed: AnalyzedArticle[] = [];
    for (const article of picked) {
      if (analyzed.length > 0) {
        await new Promise((r) => setTimeout(r, 2000));
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

    // 既存データに追記して保存
    const existing = await getArticles(today);
    const existingIds = new Set(existing.map((a) => a.id));
    const newArticles = analyzed.filter((a) => !existingIds.has(a.id));
    const combined = [...existing, ...newArticles];

    await saveArticles(today, combined);
    await setLatestDate(today);

    return NextResponse.json({
      ok: true,
      batch: Number(batch),
      date: today,
      themes: themeIds,
      picked: picked.length,
      analyzed: analyzed.length,
      existing: existing.length,
      total: combined.length,
    });
  } catch (e) {
    console.error(`Cron batch ${batch} error:`, e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
