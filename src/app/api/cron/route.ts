import { NextRequest, NextResponse } from "next/server";
import { fetchAllThemes, deduplicateArticles } from "@/lib/newsdata";
import { batchSummarize } from "@/lib/gemini";
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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. 全テーマのニュース取得（~15秒）
    const themeResults = await fetchAllThemes();
    const picked = pickBestPerTheme(themeResults);

    if (picked.length === 0) {
      return NextResponse.json({ ok: true, message: "No articles found" });
    }

    // 2. Geminiで一括軽量分析（~30秒）
    let summaries;
    try {
      summaries = await batchSummarize(picked);
    } catch (e) {
      return NextResponse.json({
        error: "batchSummarize failed",
        detail: String(e),
        picked: picked.length,
        pickedTitles: picked.map((a) => a.title).slice(0, 3),
      }, { status: 500 });
    }

    // 3. 記事データを組み立て（深層分析は空）
    const articleMap = new Map(picked.map((a) => [a.article_id, a]));
    const analyzed: AnalyzedArticle[] = summaries
      .filter((s) => articleMap.has(s.article_id))
      .map((s) => {
        const raw = articleMap.get(s.article_id)!;
        return {
          id: raw.article_id,
          title_en: raw.title,
          title_ja: s.title_ja,
          summary_ja: s.summary_ja,
          source: raw.source_name,
          url: raw.link,
          region: (raw.country ?? []).join(", "),
          published: raw.pubDate,
          read_time: 3,
          primary_theme: s.primary_theme,
          cross_themes: s.cross_themes,
          impact: s.impact,
          timeframe: s.timeframe,
          analysis: null as any, // 深層分析はオンデマンドで取得
          created_at: new Date().toISOString(),
        };
      });

    await saveArticles(today, analyzed);
    await setLatestDate(today);

    return NextResponse.json({
      ok: true,
      date: today,
      fetched: picked.length,
      analyzed: analyzed.length,
    });
  } catch (e) {
    console.error("Cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
