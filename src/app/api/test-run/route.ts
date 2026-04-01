import { NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/prompts";
import type { NewsDataArticle } from "@/lib/types";

export const maxDuration = 60;

export async function GET() {
  const errors: string[] = [];

  try {
    // 1. 1テーマだけニュース取得
    const { fetchNewsByTheme } = await import("@/lib/newsdata");
    const articles = await fetchNewsByTheme("geopolitics");

    if (articles.length === 0) {
      return NextResponse.json({ error: "No articles from NewsData", step: "fetch" });
    }

    // descriptionが長い記事を1本選ぶ
    const article = [...articles]
      .filter((a: NewsDataArticle) => a.description && a.description.length > 50)
      .sort((a: NewsDataArticle, b: NewsDataArticle) => (b.description?.length ?? 0) - (a.description?.length ?? 0))[0];

    if (!article) {
      return NextResponse.json({ error: "No article with description", step: "pick" });
    }

    // 2. Geminiに直接リクエスト（エラー詳細を全部返す）
    const articleText = `タイトル: ${article.title}
ソース: ${article.source_name}
日付: ${article.pubDate}
国: ${(article.country ?? []).join(", ")}
カテゴリ: ${(article.category ?? []).join(", ")}
概要: ${article.description ?? "(なし)"}`;

    const prompt = `${SYSTEM_PROMPT}\n\n═══════════════════════════════════════\n以下の記事を分析してください:\n\n${articleText}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const geminiStatus = geminiRes.status;
    const geminiBody = await geminiRes.text();

    if (!geminiRes.ok) {
      return NextResponse.json({
        error: "Gemini API failed",
        step: "gemini",
        status: geminiStatus,
        body: geminiBody.slice(0, 1000),
      });
    }

    // パース
    let geminiData;
    try {
      geminiData = JSON.parse(geminiBody);
    } catch {
      return NextResponse.json({
        error: "Gemini response not JSON",
        step: "parse_response",
        body: geminiBody.slice(0, 1000),
      });
    }

    const analysisText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!analysisText) {
      return NextResponse.json({
        error: "No text in Gemini response",
        step: "extract_text",
        geminiData: JSON.stringify(geminiData).slice(0, 1000),
      });
    }

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      return NextResponse.json({
        error: "Analysis text not valid JSON",
        step: "parse_analysis",
        text: analysisText.slice(0, 1000),
      });
    }

    // 3. KVに保存
    const { saveArticles, setLatestDate } = await import("@/lib/kv");
    const today = new Date().toISOString().split("T")[0];
    const analyzed = [{
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
    }];

    await saveArticles(today, analyzed);
    await setLatestDate(today);

    return NextResponse.json({
      ok: true,
      date: today,
      article_title: article.title,
      analysis_title_ja: analysis.title_ja,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), stack: (e as Error).stack?.slice(0, 500) }, { status: 500 });
  }
}
