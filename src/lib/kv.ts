import { kv } from "@vercel/kv";
import type { AnalyzedArticle, Prediction, WeeklyDeepDive, OsintSnapshot, OsintVerification, OsintArticle, IntelligenceMemory, Subsidy, TaxLawItem, FredBlogPost, TaxBlogPost } from "./types";
// Note: OsintSnapshot now uses unified data_points[] instead of separate worldbank/estat fields

// --- 補助金・助成金 ---
export async function saveSubsidies(date: string, subsidies: Subsidy[]) {
  await kv.set(`subsidies:${date}`, JSON.stringify(subsidies));
  await kv.set("meta:last_subsidies", date);
}

export async function getSubsidies(date: string): Promise<Subsidy[]> {
  const data = await kv.get<string>(`subsidies:${date}`);
  if (!data) return [];
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getLatestSubsidiesDate(): Promise<string | null> {
  return kv.get<string>("meta:last_subsidies");
}

// --- 税務情報 ---
export async function saveTaxLaw(date: string, items: TaxLawItem[]) {
  await kv.set(`taxlaw:${date}`, JSON.stringify(items));
  await kv.set("meta:last_taxlaw", date);
}

export async function getTaxLaw(date: string): Promise<TaxLawItem[]> {
  const data = await kv.get<string>(`taxlaw:${date}`);
  if (!data) return [];
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getLatestTaxLawDate(): Promise<string | null> {
  return kv.get<string>("meta:last_taxlaw");
}

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

// --- OSINT ---
export async function saveOsintSnapshot(snapshot: OsintSnapshot) {
  await kv.set(`osint:${snapshot.date}`, JSON.stringify(snapshot));
  await kv.set("osint:latest", snapshot.date);
}

export async function getOsintSnapshot(date: string): Promise<OsintSnapshot | null> {
  const data = await kv.get<string>(`osint:${date}`);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getLatestOsintDate(): Promise<string | null> {
  return kv.get<string>("osint:latest");
}

export async function saveOsintVerifications(date: string, verifications: OsintVerification[]) {
  await kv.set(`osint_verif:${date}`, JSON.stringify(verifications));
}

export async function getOsintVerifications(date: string): Promise<OsintVerification[]> {
  const data = await kv.get<string>(`osint_verif:${date}`);
  if (!data) return [];
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function saveOsintArticles(date: string, articles: OsintArticle[]) {
  await kv.set(`osint_articles:${date}`, JSON.stringify(articles));
}

export async function getOsintArticles(date: string): Promise<OsintArticle[]> {
  const data = await kv.get<string>(`osint_articles:${date}`);
  if (!data) return [];
  return typeof data === "string" ? JSON.parse(data) : data;
}

// --- 柳谷税理士ブログ ---
export async function saveTaxBlog(yearMonth: string, posts: TaxBlogPost[]) {
  await kv.set(`taxblog:${yearMonth}`, JSON.stringify(posts));
  await kv.set("meta:last_taxblog", yearMonth);
}

export async function getTaxBlog(yearMonth: string): Promise<TaxBlogPost[]> {
  const data = await kv.get<string>(`taxblog:${yearMonth}`);
  if (!data) return [];
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getLatestTaxBlogDate(): Promise<string | null> {
  return kv.get<string>("meta:last_taxblog");
}

// --- FRED Blog ---
export async function saveFredBlog(yearMonth: string, posts: FredBlogPost[]) {
  await kv.set(`fredblog:${yearMonth}`, JSON.stringify(posts));
  await kv.set("meta:last_fredblog", yearMonth);
}

export async function getFredBlog(yearMonth: string): Promise<FredBlogPost[]> {
  const data = await kv.get<string>(`fredblog:${yearMonth}`);
  if (!data) return [];
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getLatestFredBlogDate(): Promise<string | null> {
  return kv.get<string>("meta:last_fredblog");
}

// --- インテリジェンス・メモリ ---
export async function getMemory(): Promise<IntelligenceMemory | null> {
  const data = await kv.get<string>("memory:latest");
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function saveMemory(memory: IntelligenceMemory) {
  await kv.set("memory:latest", JSON.stringify(memory));
}
