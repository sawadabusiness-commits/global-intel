import { NextRequest, NextResponse } from "next/server";
import { deepAnalyze } from "@/lib/gemini";
import { getArticles, saveArticles } from "@/lib/kv";
import type { GeminiAnalysis } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { articleId, date } = await req.json();

    if (!articleId || !date) {
      return NextResponse.json({ error: "articleId and date required" }, { status: 400 });
    }

    // 記事を取得
    const articles = await getArticles(date);
    const article = articles.find((a) => a.id === articleId);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // 既に分析済みならそのまま返す
    if (article.analysis) {
      return NextResponse.json(article.analysis);
    }

    // 深層分析を実行
    const analysis = await deepAnalyze(
      article.title_en,
      article.source,
      article.published,
      article.region,
      article.summary_ja
    );

    if (!analysis) {
      return NextResponse.json({ error: "分析結果が空です" }, { status: 500 });
    }

    // 分析結果を記事に保存
    const fullAnalysis: GeminiAnalysis = {
      primary_theme: article.primary_theme,
      cross_themes: article.cross_themes,
      impact: article.impact,
      timeframe: article.timeframe,
      title_ja: article.title_ja,
      summary_ja: article.summary_ja,
      ...analysis,
    } as GeminiAnalysis;

    article.analysis = fullAnalysis;
    await saveArticles(date, articles);

    return NextResponse.json(fullAnalysis);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
