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
  analysis: GeminiAnalysis;
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
  type: "tone_shift";
  detail: string;
  severity: "high" | "medium";
  current_value: number;
  baseline_value: number;
  change_pct: number;
}

export interface OsintSnapshot {
  date: string;
  gdelt: GdeltToneData[];
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
