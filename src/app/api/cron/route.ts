import { NextRequest, NextResponse } from "next/server";
import { fetchAllThemes, deduplicateArticles } from "@/lib/newsdata";
import { analyzeArticle } from "@/lib/gemini";
import { saveArticles, getArticles, setLatestDate } from "@/lib/kv";
import type { AnalyzedArticle, NewsDataArticle } from "@/lib/types";
import { kv } from "@vercel/kv";

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

  const batch = req.nextUrl.searchParams.get("batch") ?? "1";
  const today = new Date().toISOString().split("T")[0];

  try {
    if (batch === "1") {
      // === バッチ1（4時）: ニュース取得 + 6記事分析 ===

      const themeResults = await fetchAllThemes();
      const allArticles: NewsDataArticle[] = [];
      for (const r of themeResults) {
        allArticles.push(...r.articles);
      }
      const unique = deduplicateArticles(allArticles);

      if (unique.length === 0) {
        return NextResponse.json({ ok: true, batch: 1, message: "No articles found" });
      }

      const picked = pickBestPerTheme(themeResults);

      // バッチ2用に残りの記事をKVに一時保存
      const batch1Articles = picked.slice(0, 6);
      const batch2Articles = picked.slice(6);
      if (batch2Articles.length > 0) {
        await kv.set(`pending:${today}`, JSON.stringify(batch2Articles), { ex: 7200 }); // 2時間で期限切れ
      }

      // 6記事を分析
      const analyzed: AnalyzedArticle[] = [];
      for (const article of batch1Articles) {
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

      await saveArticles(today, analyzed);
      await setLatestDate(today);

      return NextResponse.json({
        ok: true,
        batch: 1,
        date: today,
        fetched: unique.length,
        picked: picked.length,
        analyzed: analyzed.length,
        pending_batch2: batch2Articles.length,
      });

    } else {
      // === バッチ2（5時）: 残り4記事を分析 ===

      const pendingRaw = await kv.get<string>(`pending:${today}`);
      if (!pendingRaw) {
        return NextResponse.json({ ok: true, batch: 2, message: "No pending articles" });
      }

      const pendingArticles: NewsDataArticle[] =
        typeof pendingRaw === "string" ? JSON.parse(pendingRaw) : pendingRaw;

      // 既存の分析結果を読み込み
      const existing = await getArticles(today);

      const analyzed: AnalyzedArticle[] = [];
      for (const article of pendingArticles) {
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

      // 既存 + 新規を結合して保存
      const combined = [...existing, ...analyzed];
      await saveArticles(today, combined);

      // 一時データを削除
      await kv.del(`pending:${today}`);

      return NextResponse.json({
        ok: true,
        batch: 2,
        date: today,
        existing: existing.length,
        analyzed: analyzed.length,
        total: combined.length,
      });
    }
  } catch (e) {
    console.error(`Cron batch ${batch} error:`, e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
