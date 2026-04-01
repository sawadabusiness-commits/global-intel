import { SYSTEM_PROMPT, CURATION_PROMPT } from "./prompts";
import type { NewsDataArticle, GeminiAnalysis } from "./types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
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

export interface CuratedArticle {
  article_id: string;
  title: string;
  source: string;
  url: string;
  reason: string;
  expected_themes: string[];
}

export async function curateArticles(
  articles: NewsDataArticle[]
): Promise<CuratedArticle[]> {
  const articleList = articles
    .map(
      (a) =>
        `ID: ${a.article_id}\nTitle: ${a.title}\nSource: ${a.source_name}\nURL: ${a.link}\nDescription: ${a.description ?? "(なし)"}\nCountry: ${(a.country ?? []).join(", ")}\nCategory: ${(a.category ?? []).join(", ")}`
    )
    .join("\n---\n");

  const prompt = `${CURATION_PROMPT}\n\n以下が記事リストです（${articles.length}件）:\n\n${articleList}`;
  const text = await callGemini(prompt);

  try {
    return JSON.parse(text);
  } catch {
    console.error("Failed to parse curation result:", text.slice(0, 500));
    return [];
  }
}

export async function analyzeArticle(
  article: NewsDataArticle
): Promise<GeminiAnalysis | null> {
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
