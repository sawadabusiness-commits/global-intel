import { NextResponse } from "next/server";
import { deduplicateArticles } from "@/lib/newsdata";
import { analyzeArticle } from "@/lib/gemini";
import { saveArticles, setLatestDate } from "@/lib/kv";
import type { AnalyzedArticle, NewsDataArticle } from "@/lib/types";

export const maxDuration = 60;

// テーマごとに最もdescriptionが長い（情報量が多い）記事を1本選ぶ
function pickBestPerTheme(
  themeResults: { themeId: string; articles: NewsDataArticle[] }[]
): NewsDataArticle[] {
  const picked: NewsDataArticle[] = [];
  const seen = new Set<string>();

  for (const { articles } of themeResults) {
    // descriptionが長い順にソート
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

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. テストでは最初の3テーマだけ取得（時間短縮）
    const { fetchNewsByTheme } = await import("@/lib/newsdata");
    const { THEMES } = await import("@/lib/themes");
    const themeResults = [];
    for (const theme of THEMES.slice(0, 3)) {
      const articles = await fetchNewsByTheme(theme.id);
      themeResults.push({ themeId: theme.id, articles });
      console.log(`${theme.id}: ${articles.length} articles`);
    }
    const allArticles: NewsDataArticle[] = [];
    for (const r of themeResults) {
      allArticles.push(...r.articles);
    }
    const unique = deduplicateArticles(allArticles);
    console.log(`Fetched ${unique.length} unique articles`);

    if (unique.length === 0) {
      return NextResponse.json({ ok: true, message: "No articles found", fetched: 0 });
    }

    // 2. テストでは1本だけ分析
    const picked = pickBestPerTheme(themeResults).slice(0, 1);
    console.log(`Picked ${picked.length} articles for analysis`);

    // 3. Geminiで3層分析
    const analyzed: AnalyzedArticle[] = [];
    for (const article of picked) {
      if (analyzed.length > 0) {
        await new Promise((r) => setTimeout(r, 8000));
      }

      console.log(`Analyzing: ${article.title.slice(0, 60)}...`);
      const analysis = await analyzeArticle(article);
      if (!analysis) {
        console.log("Analysis returned null, skipping");
        continue;
      }

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
      console.log(`Analyzed: ${analysis.title_ja}`);
    }

    // 4. KVに保存
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
    console.error("Test run error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
