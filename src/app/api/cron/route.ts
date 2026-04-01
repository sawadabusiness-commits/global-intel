import { NextResponse } from "next/server";
import { fetchAllThemes, deduplicateArticles } from "@/lib/newsdata";
import { curateArticles, analyzeArticle } from "@/lib/gemini";
import { saveArticles, setLatestDate } from "@/lib/kv";
import type { AnalyzedArticle, NewsDataArticle } from "@/lib/types";

export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel Cronからの呼び出しを検証
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. 全テーマからニュース取得
    const themeResults = await fetchAllThemes();
    const allArticles: NewsDataArticle[] = [];
    for (const r of themeResults) {
      allArticles.push(...r.articles);
    }
    const unique = deduplicateArticles(allArticles);
    console.log(`Fetched ${unique.length} unique articles`);

    if (unique.length === 0) {
      return NextResponse.json({ ok: true, message: "No articles found" });
    }

    // 2. Geminiで記事を選別（10〜15本）
    const curated = await curateArticles(unique);
    console.log(`Curated ${curated.length} articles`);

    // 3. 選別された記事を3層分析（順番に実行してレート制限回避）
    const analyzed: AnalyzedArticle[] = [];
    for (const c of curated.slice(0, 12)) {
      const original = unique.find((a) => a.article_id === c.article_id);
      if (!original) continue;

      // レート制限回避: 8秒間隔
      if (analyzed.length > 0) {
        await new Promise((r) => setTimeout(r, 8000));
      }

      const analysis = await analyzeArticle(original);
      if (!analysis) continue;

      analyzed.push({
        id: original.article_id,
        title_en: original.title,
        title_ja: analysis.title_ja,
        summary_ja: analysis.summary_ja,
        source: original.source_name,
        url: original.link,
        region: (original.country ?? []).join(", "),
        published: original.pubDate,
        read_time: 3,
        primary_theme: analysis.primary_theme,
        cross_themes: analysis.cross_themes,
        impact: analysis.impact,
        timeframe: analysis.timeframe,
        analysis,
        created_at: new Date().toISOString(),
      });
    }

    // 4. KVに保存
    await saveArticles(today, analyzed);
    await setLatestDate(today);

    return NextResponse.json({
      ok: true,
      date: today,
      fetched: unique.length,
      curated: curated.length,
      analyzed: analyzed.length,
    });
  } catch (e) {
    console.error("Cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
