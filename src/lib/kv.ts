import { kv } from "@vercel/kv";
import type { AnalyzedArticle, Prediction, WeeklyDeepDive } from "./types";

// --- 記事 ---
export async function saveArticles(date: string, articles: AnalyzedArticle[]) {
  await kv.set(`articles:${date}`, JSON.stringify(articles));
}

export async function getArticles(date: string): Promise<AnalyzedArticle[]> {
  const data = await kv.get<string>(`articles:${date}`);
  if (!data) return [];
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getLatestDate(): Promise<string | null> {
  return kv.get<string>("meta:last_fetch");
}

export async function setLatestDate(date: string) {
  await kv.set("meta:last_fetch", date);
}

// --- 判断記録 ---
export async function savePrediction(prediction: Prediction) {
  await kv.set(`predictions:${prediction.id}`, JSON.stringify(prediction));
  await kv.lpush("predictions:index", prediction.id);
}

export async function getPrediction(id: string): Promise<Prediction | null> {
  const data = await kv.get<string>(`predictions:${id}`);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getAllPredictions(): Promise<Prediction[]> {
  const ids = await kv.lrange<string>("predictions:index", 0, -1);
  if (!ids || ids.length === 0) return [];

  const predictions = await Promise.all(ids.map((id) => getPrediction(id)));
  return predictions.filter((p): p is Prediction => p !== null);
}

export async function updatePrediction(id: string, updates: Partial<Prediction>) {
  const existing = await getPrediction(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  await kv.set(`predictions:${id}`, JSON.stringify(updated));
  return updated;
}

// --- 週次ディープダイブ ---
export async function saveWeeklyDeepDive(deepDive: WeeklyDeepDive) {
  await kv.set(`deep_dive:${deepDive.week_end}`, JSON.stringify(deepDive));
  await kv.set("deep_dive:latest", deepDive.week_end);
}

export async function getWeeklyDeepDive(weekEnd: string): Promise<WeeklyDeepDive | null> {
  const data = await kv.get<string>(`deep_dive:${weekEnd}`);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getLatestDeepDiveDate(): Promise<string | null> {
  return kv.get<string>("deep_dive:latest");
}
