import { Theme } from "./types";

export const THEMES: Theme[] = [
  {
    id: "geopolitics",
    label: "Geopolitics",
    labelJa: "地政学",
    icon: "⬡",
    color: "#F87171",
    queryKeywords: ["geopolitics", "sanctions", "trade war", "NATO", "BRICS"],
  },
  {
    id: "tech_society",
    label: "Tech × Society",
    labelJa: "テクノロジー×社会",
    icon: "◈",
    color: "#60A5FA",
    queryKeywords: ["AI regulation", "automation jobs", "digital privacy", "tech ethics"],
  },
  {
    id: "economic_policy",
    label: "Economic Policy",
    labelJa: "経済政策",
    icon: "◇",
    color: "#FBBF24",
    queryKeywords: ["central bank", "interest rate", "inflation", "tariff"],
  },
  {
    id: "emerging_markets",
    label: "Emerging Markets",
    labelJa: "新興国",
    icon: "◆",
    color: "#34D399",
    queryKeywords: ["emerging market", "Africa economy", "India growth", "Southeast Asia"],
  },
  {
    id: "crime_drugs",
    label: "Crime & Drugs",
    labelJa: "犯罪・ドラッグ",
    icon: "▣",
    color: "#C084FC",
    queryKeywords: ["cartel", "fentanyl", "organized crime", "money laundering"],
  },
  {
    id: "demographics",
    label: "Demographics",
    labelJa: "人口動態・労働",
    icon: "⏣",
    color: "#FB923C",
    queryKeywords: ["aging population", "immigration policy", "labor shortage"],
  },
  {
    id: "energy_resources",
    label: "Energy & Resources",
    labelJa: "エネルギー・資源",
    icon: "⬢",
    color: "#4ADE80",
    queryKeywords: ["rare earth", "oil price", "renewable energy", "energy security"],
  },
  {
    id: "financial_system",
    label: "Financial System",
    labelJa: "金融・通貨体制",
    icon: "⟐",
    color: "#38BDF8",
    queryKeywords: ["CBDC", "digital currency", "banking crisis", "fintech"],
  },
  {
    id: "food_supply",
    label: "Food & Supply Chain",
    labelJa: "食料・サプライチェーン",
    icon: "⬟",
    color: "#A3E635",
    queryKeywords: ["food security", "supply chain", "agriculture", "food price"],
  },
  {
    id: "space_cyber",
    label: "Space & Cyber",
    labelJa: "宇宙・海洋・サイバー",
    icon: "◎",
    color: "#E879F9",
    queryKeywords: ["satellite", "cyber attack", "submarine cable"],
  },
  {
    id: "llm_api",
    label: "LLM & AI API",
    labelJa: "LLM・AI基盤",
    icon: "⬣",
    color: "#22D3EE",
    queryKeywords: ["LLM API", "GPT model", "Gemini API", "Claude API", "AI pricing"],
  },
];

export const THEME_MAP = Object.fromEntries(
  THEMES.map((t) => [t.id, t])
) as Record<string, Theme>;

export const IMPACT_LEVELS = {
  5: { label: "Structural Shift", labelJa: "構造転換", color: "#DC2626" },
  4: { label: "Deep Insight", labelJa: "深い示唆", color: "#F59E0B" },
  3: { label: "Notable Signal", labelJa: "注目シグナル", color: "#6366F1" },
} as const;

export const TIMEFRAMES = {
  short: { label: "1-2 years", labelJa: "短期（1〜2年）", color: "#38BDF8" },
  mid: { label: "3-5 years", labelJa: "中期（3〜5年）", color: "#FBBF24" },
  long: { label: "5-15 years", labelJa: "長期（5〜15年）", color: "#F87171" },
} as const;

export const PROBABILITY_COLORS: Record<string, string> = {
  "高": "#DC2626",
  "中〜高": "#F59E0B",
  "中": "#6366F1",
  "低〜中": "#64748B",
  "低": "#374151",
};

export const PREDICTION_STATUS = {
  correct: { label: "的中", color: "#10B981", icon: "✓" },
  partially_correct: { label: "部分的中", color: "#F59E0B", icon: "◐" },
  incorrect: { label: "外れ", color: "#EF4444", icon: "✗" },
  ongoing: { label: "検証中", color: "#6366F1", icon: "◌" },
} as const;
