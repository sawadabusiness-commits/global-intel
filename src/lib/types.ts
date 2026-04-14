// --- テーマ ---
export type ThemeId =
  | "geopolitics"
  | "tech_society"
  | "economic_policy"
  | "emerging_markets"
  | "crime_drugs"
  | "demographics"
  | "energy_resources"
  | "financial_system"
  | "food_supply"
  | "space_cyber"
  | "llm_api";

export interface Theme {
  id: ThemeId;
  label: string;
  labelJa: string;
  icon: string;
  color: string;
  queryKeywords: string[];
}

// --- 時間軸 ---
export type Timeframe = "short" | "mid" | "long";

// --- インパクトレベル ---
export type ImpactLevel = 3 | 4 | 5;

// --- 蓋然性 ---
export type Probability = "高" | "中〜高" | "中" | "低〜中" | "低";

// --- NewsData.io API レスポンス ---
export interface NewsDataArticle {
  article_id: string;
  title: string;
  link: string;
  description: string | null;
  content: string | null;
  pubDate: string;
  source_id: string;
  source_name: string;
  source_url: string;
  language: string;
  country: string[];
  category: string[];
  image_url: string | null;
}

export interface NewsDataResponse {
  status: string;
  totalResults: number;
  results: NewsDataArticle[];
  nextPage: string | null;
}

// --- Gemini分析結果 ---
export interface StructuralFactor {
  factor: string;
  detail: string;
}

export interface CrossThemeConnection {
  theme: ThemeId;
  connection: string;
}

export interface Scenario {
  name: string;
  probability: Probability;
  timeframe: Timeframe;
  description: string;
}

export interface CounterArgument {
  point: string;
  detail: string;
}

export interface HistoricalCase {
  event: string;
  parallel: string;
  outcome: string;
  lesson: string;
}

export interface Analyst1Result {
  structural_factors: StructuralFactor[];
  cross_theme_connections: CrossThemeConnection[];
  scenarios: Scenario[];
  signals_to_watch: string[];
  japan_implications: string;
}

export interface Analyst2Result {
  counterarguments: CounterArgument[];
  biggest_error_source: string;
  consensus_bias: string;
  blind_spot: string;
}

export interface Analyst3Result {
  historical_cases: HistoricalCase[];
  overlooked_risk: string;
  probability_correction: string;
}

export interface GeminiAnalysis {
  primary_theme: ThemeId;
  cross_themes: ThemeId[];
  impact: ImpactLevel;
  timeframe: Timeframe;
  analyst1: Analyst1Result;
  analyst2: Analyst2Result;
  analyst3: Analyst3Result;
  title_ja: string;
  summary_ja: string;
}

// --- 補助金・助成金 ---
export type IndustryTag = "medical" | "welfare" | "construction" | "food_manufacturing" | "retail" | "general";

export interface Subsidy {
  id: string;              // ソース別一意ID
  source: "jgrants" | "mhlw" | "city-hatsukaichi" | "city-shiso" | "city-hiroshima";
  title: string;
  url: string;
  summary?: string;        // 本文抜粋
  published_at: string;    // ISO
  deadline?: string | null;
  target_area: string[];   // ["全国"] or ["広島県","兵庫県"] 等
  industry_tags: IndustryTag[];
  amount_max?: number | null;
  fetched_at: string;
}

// --- 記事（分析済み） ---
export interface AnalyzedArticle {
  id: string;
  title_en: string;
  title_ja: string;
  summary_ja: string;
  source: string;
  url: string;
  region: string;
  published: string;
  read_time: number;
  primary_theme: ThemeId;
  cross_themes: ThemeId[];
  impact: ImpactLevel;
  timeframe: Timeframe;
  analysis: GeminiAnalysis | null;
  mermaid?: string;
  created_at: string;
}

// --- 判断記録 ---
export type PredictionStatus =
  | "ongoing"
  | "correct"
  | "partially_correct"
  | "incorrect";

export interface Prediction {
  id: string;
  article_id: string;
  article_title: string;
  theme: ThemeId;
  date: string;
  my_scenario: string;
  my_confidence: Probability;
  my_reasoning: string;
  ai_scenarios: Scenario[];
  status: PredictionStatus;
  verification_date: string | null;
  actual_outcome: string | null;
  score: number | null;
  lessons: string | null;
}

// --- 週次ディープダイブ ---
export interface WeeklyDeepDive {
  id: string;
  week_start: string;
  week_end: string;
  theme: ThemeId;
  theme_label_ja: string;
  article_count: number;
  report: WeeklyReport;
  created_at: string;
}

export interface WeeklyReport {
  title: string;
  executive_summary: string;
  key_developments: { headline: string; detail: string; date: string }[];
  trend_analysis: string;
  cross_theme_impact: { theme: ThemeId; impact: string }[];
  scenarios: { name: string; probability: string; description: string }[];
  japan_implications: string;
  watch_next_week: string[];
  notable_services?: { name: string; url: string; description: string; score: number }[];
}

// --- OSINT ---
export interface GdeltToneData {
  theme: ThemeId;
  query: string;
  daily_tone: { date: string; tone: number }[];
  latest_tone: number;
  avg_tone_7d: number;
  tone_change_pct: number;
  is_anomaly: boolean;
}

export interface OsintAnomaly {
  theme: ThemeId;
  source: string;
  type: "tone_shift" | "indicator_change" | "conflict_spike" | "filing_surge" | "earthquake_spike";
  detail: string;
  severity: "high" | "medium";
  current_value: number;
  baseline_value: number;
  change_pct: number;
}

export interface OsintDataPoint {
  source: "dbnomics" | "fred" | "edinet" | "estat" | "usgs" | "fao" | "opensanctions" | "comtrade" | "gfw" | "ucdp" | "boj";
  category: "macro" | "conflict" | "finance" | "trade" | "filing" | "price" | "disaster" | "military" | "sanctions" | "maritime";
  indicator: string;
  label: string;
  value: number | null;
  date: string;
  country?: string;
  unit?: string;
}

export interface OsintSnapshot {
  date: string;
  gdelt: GdeltToneData[];
  data_points: OsintDataPoint[];
  anomalies: OsintAnomaly[];
  created_at: string;
}

export interface OsintVerification {
  article_id: string;
  verdict: "supported" | "contradicted" | "unverifiable";
  evidence: string;
  data_points: string[];
  confidence: string;
}

export interface OsintArticle {
  id: string;
  title: string;
  body: string;
  theme: ThemeId;
  data_sources: string[];
  anomalies_referenced: string[];
  confidence: string;
  generated_at: string;
}

// --- インテリジェンス・メモリ ---
export interface KeyIndicatorTracker {
  indicator: string;
  source: string;
  label: string;
  current_value: number;
  previous_value: number | null;
  change: number | null;
  change_pct: number | null;
  trend: "rising" | "falling" | "stable";
  history: { date: string; value: number }[];
  first_seen: string;
  last_updated: string;
}

export interface ThemeNarrative {
  theme: ThemeId;
  current_summary: string;
  key_developments: string[];
  dominant_trend: string;
  last_updated: string;
}

export interface WeeklyMemorySummary {
  week_end: string;
  theme: ThemeId;
  one_liner: string;
  key_numbers: string[];
}

export interface IntelligenceMemory {
  date: string;
  version: number;
  key_indicators: KeyIndicatorTracker[];
  theme_narratives: Partial<Record<ThemeId, ThemeNarrative>>;
  weekly_summaries: WeeklyMemorySummary[];
}

// --- Vercel KV のキー設計 ---
// articles:{date}        → AnalyzedArticle[]
// predictions:{id}       → Prediction
// predictions:index      → string[]
// deep_dive:{date}       → WeeklyDeepDive
// deep_dive:latest       → string (date)
// osint:{date}           → OsintSnapshot
// osint:latest           → string (date)
// osint_verif:{date}     → OsintVerification[]
// osint_articles:{date}  → OsintArticle[]
// meta:last_fetch        → string
