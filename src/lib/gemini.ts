import { DEEP_ANALYSIS_PROMPT } from "./prompts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GITHUB_MODELS_URL = "https://models.inference.ai.azure.com/chat/completions";
const MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-3.1-flash-lite-preview", "gemini-2.0-flash"];

async function callGeminiWithModel(
  model: string,
  prompt: string,
  maxTokens: number,
  timeoutMs = 45000
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(
    `${GEMINI_BASE}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      }),
    }
  ).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// 3 Flash → 2.5 Flash → 3.1 Lite → 2.0 Flash の順でフォールバック
let lastUsedModel = "";

export function getLastUsedModel() {
  return lastUsedModel;
}

async function callGemini(prompt: string, maxTokens = 8192): Promise<string> {
  for (let i = 0; i < MODELS.length; i++) {
    try {
      const isLast = i === MODELS.length - 1;
      const result = await callGeminiWithModel(MODELS[i], prompt, maxTokens, isLast ? 45000 : 8000);
      lastUsedModel = MODELS[i];
      return result;
    } catch (e) {
      const msg = String(e);
      const isRetryable = msg.includes("429") || msg.includes("503") || msg.includes("abort");
      if (isRetryable) {
        console.log(`${MODELS[i]} failed (${msg.includes("429") ? "429" : msg.includes("503") ? "503" : "timeout"})${i < MODELS.length - 1 ? `, trying ${MODELS[i + 1]}` : ", trying GitHub Models"}`);
        continue;
      }
      throw e;
    }
  }
  // 最終フォールバック: GitHub Models (gpt-4o-mini)
  console.log("All Gemini models failed, falling back to GitHub Models (gpt-4o-mini)");
  try {
    const result = await callGitHubModels(prompt, maxTokens);
    lastUsedModel = "gpt-4o-mini (GitHub Models)";
    return result;
  } catch (e) {
    throw new Error(`All models failed. Last error: ${e}`);
  }
}

async function callGitHubModels(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch(GITHUB_MODELS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "出力はJSON形式のみで返してください。前文やMarkdownのバックティックは不要です。" },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub Models error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/) ?? text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
  return jsonMatch[0];
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
): Promise<DeepAnalysis> {
  const articleText = `タイトル: ${title}
ソース: ${source}
日付: ${published}
地域: ${region}
要約: ${summary}`;

  const prompt = `${DEEP_ANALYSIS_PROMPT}\n\n═══════════════════════════════════════\n以下の記事を分析してください:\n\n${articleText}`;

  const text = await callGemini(prompt, 8192);
  return JSON.parse(text);
}
