import { BATCH_SUMMARY_PROMPT, DEEP_ANALYSIS_PROMPT } from "./prompts";
import type { NewsDataArticle, ThemeId, ImpactLevel, Timeframe } from "./types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function callGemini(prompt: string, maxTokens = 8192): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// --- Cron用: 複数記事を一括で軽量分析 ---
export interface BatchSummaryItem {
  article_id: string;
  title_ja: string;
  summary_ja: string;
  primary_theme: ThemeId;
  cross_themes: ThemeId[];
  impact: ImpactLevel;
  timeframe: Timeframe;
}

export async function batchSummarize(
  articles: NewsDataArticle[]
): Promise<BatchSummaryItem[]> {
  const articleList = articles
    .map(
      (a, i) =>
        `--- 記事${i + 1} ---
article_id: ${a.article_id}
タイトル: ${a.title}
ソース: ${a.source_name}
日付: ${a.pubDate}
国: ${(a.country ?? []).join(", ")}
カテゴリ: ${(a.category ?? []).join(", ")}
概要: ${a.description ?? "(なし)"}`
    )
    .join("\n\n");

  const prompt = `${BATCH_SUMMARY_PROMPT}\n\n═══════════════════════════════════════\n以下の${articles.length}件の記事を分析してください:\n\n${articleList}`;

  try {
    const text = await callGemini(prompt, 4096);
    return JSON.parse(text);
  } catch (e) {
    console.error("Batch summarize failed:", e);
    return [];
  }
}

// --- オンデマンド: 1記事の深層3層分析 ---
export interface DeepAnalysis {
  analyst1: {
    structural_factors: { factor: string; detail: string }[];
    cross_theme_connections: { theme: string; connection: string }[];
    scenarios: { name: string; probability: string; timeframe: string; description: string }[];
    signals_to_watch: string[];
    japan_implications: string;
  };
  analyst2: {
    counterarguments: { point: string; detail: string }[];
    biggest_error_source: string;
    consensus_bias: string;
    blind_spot: string;
  };
  analyst3: {
    historical_cases: { event: string; parallel: string; outcome: string; lesson: string }[];
    overlooked_risk: string;
    probability_correction: string;
  };
}

export async function deepAnalyze(
  title: string,
  source: string,
  published: string,
  region: string,
  summary: string
): Promise<DeepAnalysis | null> {
  const articleText = `タイトル: ${title}
ソース: ${source}
日付: ${published}
地域: ${region}
要約: ${summary}`;

  const prompt = `${DEEP_ANALYSIS_PROMPT}\n\n═══════════════════════════════════════\n以下の記事を分析してください:\n\n${articleText}`;

  try {
    const text = await callGemini(prompt, 8192);
    return JSON.parse(text);
  } catch (e) {
    console.error("Deep analysis failed:", e);
    return null;
  }
}

// 後方互換
export async function analyzeArticle(article: NewsDataArticle) {
  const { SYSTEM_PROMPT } = await import("./prompts");
  const articleText = `タイトル: ${article.title}
ソース: ${article.source_name}
日付: ${article.pubDate}
国: ${(article.country ?? []).join(", ")}
カテゴリ: ${(article.category ?? []).join(", ")}
概要: ${article.description ?? "(なし)"}`;

  const prompt = `${SYSTEM_PROMPT}\n\n═══════════════════════════════════════\n以下の記事を分析してください:\n\n${articleText}`;

  try {
    const text = await callGemini(prompt);
    return JSON.parse(text);
  } catch (e) {
    console.error(`Analysis failed for "${article.title}":`, e);
    return null;
  }
}
