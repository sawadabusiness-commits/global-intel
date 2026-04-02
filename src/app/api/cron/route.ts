import { NextRequest, NextResponse } from "next/server";
import { fetchAllThemes, deduplicateArticles } from "@/lib/newsdata";
import { batchSummarize, batchDeepAnalyze, verifyPrediction } from "@/lib/github-models";
import { saveArticles, setLatestDate, getAllPredictions, updatePrediction } from "@/lib/kv";
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

    // 3. 記事データを組み立て
    const articleMap = new Map(picked.map((a) => [a.article_id, a]));
    const validSummaries = summaries.filter((s) => articleMap.has(s.article_id));

    // 4. 深層分析を一括実行（GitHub Models、4記事ずつ）
    let deepResults: (import("@/lib/gemini").DeepAnalysis | null)[] = [];
    try {
      deepResults = await batchDeepAnalyze(
        validSummaries.map((s) => {
          const raw = articleMap.get(s.article_id)!;
          return {
            title: raw.title,
            source: raw.source_name,
            published: raw.pubDate,
            region: (raw.country ?? []).join(", "),
            summary: s.summary_ja,
          };
        })
      );
    } catch (e) {
      console.error("Batch deep analysis failed:", e);
      deepResults = validSummaries.map(() => null);
    }

    const analyzed: AnalyzedArticle[] = validSummaries.map((s, i) => {
      const raw = articleMap.get(s.article_id)!;
      const deep = deepResults[i];
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
        analysis: deep ? {
          primary_theme: s.primary_theme,
          cross_themes: s.cross_themes,
          impact: s.impact,
          timeframe: s.timeframe,
          title_ja: s.title_ja,
          summary_ja: s.summary_ja,
          ...deep,
        } as any : null,
        created_at: new Date().toISOString(),
      };
    });

    await saveArticles(today, analyzed);
    await setLatestDate(today);

    const deepAnalyzed = deepResults.filter((r) => r !== null).length;

    // 5. 予測検証（6ヶ月経過した未検証の予測を最大3件）
    let verified = 0;
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const cutoff = sixMonthsAgo.toISOString().split("T")[0];

      const predictions = await getAllPredictions();
      const due = predictions.filter(
        (p) => p.status === "ongoing" && p.date <= cutoff
      ).slice(0, 3);

      for (const p of due) {
        try {
          const result = await verifyPrediction(p);
          await updatePrediction(p.id, {
            status: result.status,
            actual_outcome: result.actual_outcome,
            score: result.score,
            lessons: result.lessons,
            verification_date: today,
          });
          verified++;
        } catch (e) {
          console.error(`Verification failed for ${p.id}:`, e);
        }
      }
    } catch (e) {
      console.error("Verification step error:", e);
    }

    return NextResponse.json({
      ok: true,
      date: today,
      fetched: picked.length,
      analyzed: analyzed.length,
      deepAnalyzed,
      verified,
      model: "gpt-4o-mini (GitHub Models)",
    });
  } catch (e) {
    console.error("Cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
