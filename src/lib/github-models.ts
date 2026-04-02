import { BATCH_SUMMARY_PROMPT, DEEP_ANALYSIS_PROMPT, WEEKLY_DEEP_DIVE_PROMPT, ANALYST4_VERIFICATION_PROMPT, ANALYST5_NOVEL_ARTICLE_PROMPT } from "./prompts";
import type { NewsDataArticle, ThemeId, ImpactLevel, Timeframe, Prediction, PredictionStatus, WeeklyReport, OsintVerification, OsintArticle, OsintAnomaly, GdeltToneData, OsintDataPoint } from "./types";
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

async function summarizeChunk(
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

const CHUNK_SIZE = 4;

export async function batchSummarize(
  articles: NewsDataArticle[]
): Promise<BatchSummaryItem[]> {
  // 4記事ずつバッチ分割して並列実行（GitHub Models 8000トークン制限対策）
  const chunks: NewsDataArticle[][] = [];
  for (let i = 0; i < articles.length; i += CHUNK_SIZE) {
    chunks.push(articles.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) => summarizeChunk(chunk).catch(() => [] as BatchSummaryItem[]))
  );
  return results.flat();
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

// --- アナリスト4: OSINT記事検証 ---
export async function batchVerifyWithOsint(
  articles: { id: string; title_ja: string; summary_ja: string; primary_theme: ThemeId }[],
  gdeltData: GdeltToneData[],
  dataPoints: OsintDataPoint[] = [],
): Promise<OsintVerification[]> {
  const gdeltContext = gdeltData.map((d) =>
    `テーマ: ${d.theme} | 最新トーン: ${d.latest_tone.toFixed(2)} | 7日平均: ${d.avg_tone_7d.toFixed(2)} | 変化: ${d.tone_change_pct > 0 ? "+" : ""}${d.tone_change_pct.toFixed(1)}% | 異常: ${d.is_anomaly ? "YES" : "NO"}`
  ).join("\n");

  // ソース別にデータポイントをグルーピング
  const bySource = new Map<string, OsintDataPoint[]>();
  for (const dp of dataPoints) {
    if (!bySource.has(dp.source)) bySource.set(dp.source, []);
    bySource.get(dp.source)!.push(dp);
  }

  const sourceLabels: Record<string, string> = {
    dbnomics: "World Bank（マクロ経済・軍事費）",
    fred: "FRED（米国金融指標）",
    edinet: "EDINET（日本有報）",
    estat: "e-Stat（日本統計）",
    usgs: "USGS（地震データ）",
    fao: "FAO（食料価格指数）",
    opensanctions: "OpenSanctions（制裁データ）",
  };

  let extraContext = "";
  for (const [source, points] of bySource) {
    extraContext += `\n\n【${sourceLabels[source] ?? source}】\n`;
    extraContext += points.map((dp) =>
      `${dp.label} | ${dp.date}: ${dp.value} ${dp.unit ?? ""}${dp.country ? ` (${dp.country})` : ""}`
    ).join("\n");
  }

  const osintContext = gdeltContext + extraContext;

  const articleList = articles.map((a) =>
    `ID: ${a.id}\nテーマ: ${a.primary_theme}\nタイトル: ${a.title_ja}\n要約: ${a.summary_ja}`
  ).join("\n---\n");

  const userPrompt = `【OSINTデータ（GDELTメディアトーン分析）】\n${osintContext}\n\n【検証対象記事】\n${articleList}`;

  const res = await fetch(GITHUB_MODELS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: ANALYST4_VERIFICATION_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub Models error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  return JSON.parse(jsonMatch[0]);
}

// --- アナリスト5: OSINT独自記事生成 ---
export async function generateNovelArticle(
  anomalies: OsintAnomaly[],
  gdeltData: GdeltToneData[],
  dataPoints: OsintDataPoint[] = []
): Promise<OsintArticle | null> {
  if (anomalies.length === 0) return null;

  const anomalyText = anomalies.map((a) =>
    `テーマ: ${a.theme} | ${a.detail} | 深刻度: ${a.severity}`
  ).join("\n");

  // 異常値に関連するソースのデータポイントを添付（AIが具体的な事実を引用できるように）
  const relevantSources = new Set(anomalies.map((a) => a.source));
  const relevantPoints = dataPoints.filter((dp) => relevantSources.has(dp.source));
  const dataText = relevantPoints.length > 0
    ? relevantPoints.map((dp) =>
        `${dp.source} | ${dp.label}: ${dp.value} ${dp.unit ?? ""}${dp.country ? ` (${dp.country})` : ""} | ${dp.date}`
      ).join("\n")
    : "";

  const contextText = gdeltData.length > 0
    ? gdeltData.map((d) =>
        `テーマ: ${d.theme} | トーン推移(14日): ${d.daily_tone.slice(-7).map((t) => t.tone.toFixed(1)).join(" → ")} | 異常: ${d.is_anomaly ? "YES" : "NO"}`
      ).join("\n")
    : "(GDELTデータなし)";

  let userPrompt = `【検出された異常値】\n${anomalyText}`;
  if (dataText) {
    userPrompt += `\n\n【関連する生データ（具体的な数値・地名を記事に必ず引用すること）】\n${dataText}`;
  }
  userPrompt += `\n\n【GDELTトーンデータ】\n${contextText}`;

  const res = await fetch(GITHUB_MODELS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: ANALYST5_NOVEL_ARTICLE_PROMPT },
        { role: "user", content: userPrompt },
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

  const parsed = JSON.parse(jsonMatch[0]);
  const today = new Date().toISOString().split("T")[0];
  return {
    id: `osint-${today}-${Date.now()}`,
    ...parsed,
    generated_at: new Date().toISOString(),
  };
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
