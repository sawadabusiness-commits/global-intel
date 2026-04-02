import { BATCH_SUMMARY_PROMPT, DEEP_ANALYSIS_PROMPT, WEEKLY_DEEP_DIVE_PROMPT } from "./prompts";
import type { NewsDataArticle, ThemeId, ImpactLevel, Timeframe, Prediction, PredictionStatus, WeeklyReport } from "./types";
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

// --- 週次ディープダイブ ---
export async function generateWeeklyDeepDive(
  themeLabelJa: string,
  articles: { title_ja: string; summary_ja: string; published: string }[]
): Promise<WeeklyReport> {
  const articleList = articles
    .map(
      (a, i) =>
        `--- 記事${i + 1} ---\n日付: ${a.published}\nタイトル: ${a.title_ja}\n要約: ${a.summary_ja}`
    )
    .join("\n\n");

  const userPrompt = `テーマ「${themeLabelJa}」の今週の記事${articles.length}件を分析し、週次ディープダイブレポートを作成してください:\n\n${articleList}`;

  const res = await fetch(GITHUB_MODELS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: WEEKLY_DEEP_DIVE_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 8192,
      temperature: 0.7,
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
    throw new Error(`No JSON in weekly deep dive response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(jsonMatch[0]);
}

// --- 深層分析（GitHub Models版、1記事ずつ並列） ---
export async function batchDeepAnalyze(
  articles: { title: string; source: string; published: string; region: string; summary: string }[]
): Promise<(DeepAnalysis | null)[]> {
  // 全記事を並列でリクエスト
  const promises = articles.map((a) => deepAnalyzeSingle(a));
  return Promise.all(promises);
}

async function deepAnalyzeSingle(
  article: { title: string; source: string; published: string; region: string; summary: string }
): Promise<DeepAnalysis | null> {
  const articleText = `タイトル: ${article.title}\nソース: ${article.source}\n日付: ${article.published}\n地域: ${article.region}\n要約: ${article.summary}`;

  try {
    const res = await fetch(GITHUB_MODELS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `${DEEP_ANALYSIS_PROMPT}\n\n出力はJSON形式のみ。前文やバックティック不要。` },
          { role: "user", content: `以下の記事を分析してください:\n\n${articleText}` },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}
