import { BATCH_SUMMARY_PROMPT, DEEP_ANALYSIS_PROMPT } from "./prompts";
import type { NewsDataArticle, ThemeId, ImpactLevel, Timeframe, Prediction, PredictionStatus } from "./types";
import type { DeepAnalysis } from "./gemini";

const GITHUB_MODELS_URL = "https://models.inference.ai.azure.com/chat/completions";

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

  const userPrompt = `以下の${articles.length}件の記事を分析してください:\n\n${articleList}`;

  const res = await fetch(GITHUB_MODELS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: BATCH_SUMMARY_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 16384,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub Models error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";

  // JSON部分を抽出（```json...```で囲まれている場合に対応）
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`No JSON array in response: ${text.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array, got: ${JSON.stringify(parsed).slice(0, 200)}`);
  }
  return parsed;
}

// --- 予測検証 ---
export interface VerificationResult {
  status: PredictionStatus;
  actual_outcome: string;
  score: number;
  lessons: string;
}

export async function verifyPrediction(prediction: Prediction): Promise<VerificationResult> {
  const systemPrompt = `あなたはニュース予測の検証官です。
ユーザーが過去に記録した予測シナリオについて、現在の知識に基づいて検証してください。
出力はJSON形式のみで返してください。前文やMarkdownのバックティックは不要です。

【出力JSON形式】
{
  "status": "correct" | "partially_correct" | "incorrect",
  "actual_outcome": "実際に起きたこと（200字以内）",
  "score": 0〜100の整数（的中度。100=完全的中, 50=部分的中, 0=完全外れ）,
  "lessons": "この予測から得られる教訓（100字以内）"
}

判定基準:
- correct: シナリオの主要な要素が概ね実現した（score 70-100）
- partially_correct: 方向性は合っていたが詳細は異なる（score 30-69）
- incorrect: シナリオとは異なる展開になった（score 0-29）
- 情報が不十分で判定困難な場合は partially_correct / score 50 として「判定困難」と明記`;

  const userPrompt = `以下の予測を検証してください:

記事タイトル: ${prediction.article_title}
テーマ: ${prediction.theme}
予測日: ${prediction.date}
選択シナリオ: ${prediction.my_scenario}
確信度: ${prediction.my_confidence}
判断根拠: ${prediction.my_reasoning || "(なし)"}

AIが提示していたシナリオ一覧:
${prediction.ai_scenarios.map((s, i) => `${i + 1}. ${s.name}（${s.probability}）: ${s.description}`).join("\n")}`;

  const res = await fetch(GITHUB_MODELS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub Models error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON in verification response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(jsonMatch[0]);
}

// --- 深層分析（GitHub Models版） ---
export async function batchDeepAnalyze(
  articles: { title: string; source: string; published: string; region: string; summary: string }[]
): Promise<(DeepAnalysis | null)[]> {
  // 6記事ずつに分割して処理
  const chunkSize = 6;
  const results: (DeepAnalysis | null)[] = [];

  for (let i = 0; i < articles.length; i += chunkSize) {
    const chunk = articles.slice(i, i + chunkSize);
    const chunkResults = await deepAnalyzeChunk(chunk);
    results.push(...chunkResults);
  }
  return results;
}

async function deepAnalyzeChunk(
  articles: { title: string; source: string; published: string; region: string; summary: string }[]
): Promise<(DeepAnalysis | null)[]> {
  const articleTexts = articles.map((a, i) =>
    `=== 記事${i + 1} ===
タイトル: ${a.title}
ソース: ${a.source}
日付: ${a.published}
地域: ${a.region}
要約: ${a.summary}`
  ).join("\n\n");

  const systemPrompt = `${DEEP_ANALYSIS_PROMPT}

重要: 複数の記事が提示されます。各記事について個別に分析し、JSON配列で返してください。
各要素は上記のJSON形式（analyst1, analyst2, analyst3を含むオブジェクト）です。
記事の順番通りに配列に格納してください。`;

  const res = await fetch(GITHUB_MODELS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `以下の${articles.length}件の記事をそれぞれ分析してください:\n\n${articleTexts}` },
      ],
      max_tokens: 16384,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Deep analysis chunk failed: ${res.status} ${err.slice(0, 200)}`);
    return articles.map(() => null);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("No JSON array in deep analysis response");
    return articles.map(() => null);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    // 記事数に合わせて返す（足りない場合はnullで埋める）
    return articles.map((_, i) => parsed[i] ?? null);
  } catch {
    console.error("Failed to parse deep analysis JSON");
    return articles.map(() => null);
  }
}
