import type { ThemeId, GdeltToneData, OsintAnomaly, WorldBankDataPoint, EStatDataPoint } from "./types";

// ============================================================
// GDELT — メディアトーン監視（APIキー不要）
// ============================================================
const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

const THEME_QUERIES: [ThemeId, string][] = [
  ["geopolitics", "sanctions OR NATO OR BRICS OR territorial dispute"],
  ["economic_policy", "inflation OR interest rate OR tariff OR central bank"],
  ["energy_resources", "oil price OR renewable energy OR rare earth OR energy crisis"],
  ["food_supply", "food price OR food security OR agriculture crisis"],
  ["financial_system", "banking crisis OR CBDC OR digital currency OR cryptocurrency"],
  ["emerging_markets", "emerging market OR developing economy OR India growth"],
];

async function fetchGdeltTone(query: string): Promise<{ date: string; tone: number }[]> {
  const url = `${GDELT_DOC_URL}?query=${encodeURIComponent(query)}&mode=timelinetone&timespan=14d&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GDELT error ${res.status}`);
  const data = await res.json();
  const series = data?.timeline?.[0]?.series ?? [];
  return series.map((s: { date: string; value: string }) => ({
    date: String(s.date),
    tone: parseFloat(String(s.value)) || 0,
  }));
}

export async function fetchAllGdeltData(): Promise<GdeltToneData[]> {
  const promises = THEME_QUERIES.map(async ([theme, query]) => {
    try {
      const daily = await fetchGdeltTone(query);
      if (daily.length < 3) return null;

      const latest = daily[daily.length - 1];
      const prev7 = daily.slice(Math.max(0, daily.length - 8), daily.length - 1);
      const avgTone = prev7.length > 0
        ? prev7.reduce((sum, d) => sum + d.tone, 0) / prev7.length
        : 0;
      const toneChange = Math.abs(avgTone) > 0.01
        ? ((latest.tone - avgTone) / Math.abs(avgTone)) * 100
        : 0;
      const isAnomaly = Math.abs(toneChange) > 50;

      return {
        theme,
        query,
        daily_tone: daily,
        latest_tone: latest.tone,
        avg_tone_7d: avgTone,
        tone_change_pct: toneChange,
        is_anomaly: isAnomaly,
      } satisfies GdeltToneData;
    } catch {
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter((r): r is GdeltToneData => r !== null);
}

// ============================================================
// World Bank — マクロ経済指標（APIキー不要）
// ============================================================
const WB_BASE = "https://api.worldbank.org/v2";
const WB_COUNTRIES = "WLD;USA;CHN;JPN;DEU;IND;BRA";
const WB_INDICATORS: { id: string; label: string }[] = [
  { id: "NY.GDP.MKTP.KD.ZG", label: "GDP成長率 (年率%)" },
  { id: "FP.CPI.TOTL.ZG", label: "消費者物価上昇率 (年率%)" },
];

export async function fetchWorldBankData(): Promise<WorldBankDataPoint[]> {
  const currentYear = new Date().getFullYear();
  const dateRange = `${currentYear - 3}:${currentYear}`;
  const results: WorldBankDataPoint[] = [];

  const promises = WB_INDICATORS.map(async (ind) => {
    try {
      const url = `${WB_BASE}/country/${WB_COUNTRIES}/indicator/${ind.id}?date=${dateRange}&format=json&per_page=100`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const data = await res.json();
      const entries = data?.[1] ?? [];
      return entries
        .filter((e: { value: number | null }) => e.value !== null)
        .map((e: { indicator: { id: string }; country: { id: string; value: string }; date: string; value: number }) => ({
          indicator_id: e.indicator.id,
          indicator_label: ind.label,
          country: e.country.value,
          country_code: e.country.id,
          date: e.date,
          value: e.value,
        }));
    } catch {
      return [];
    }
  });

  const allResults = await Promise.all(promises);
  for (const r of allResults) results.push(...r);
  return results;
}

// ============================================================
// e-Stat — 日本政府統計（APIキー必要、ESTAT_API_KEY環境変数）
// ============================================================
const ESTAT_BASE = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData";

// 消費者物価指数（総合）: 政府統計コード 00200573
// 統計表ID: 最新のCPI月次データ
const ESTAT_STATS: { statsDataId: string; label: string; unit: string }[] = [
  { statsDataId: "0003421913", label: "消費者物価指数（総合）", unit: "指数" },
];

export async function fetchEStatData(): Promise<EStatDataPoint[]> {
  const apiKey = process.env.ESTAT_API_KEY;
  if (!apiKey) return [];

  const results: EStatDataPoint[] = [];

  for (const stat of ESTAT_STATS) {
    try {
      const url = `${ESTAT_BASE}?appId=${apiKey}&statsDataId=${stat.statsDataId}&limit=12&startPosition=1&metaGetFlg=N&sectionHeaderFlg=2`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;

      const data = await res.json();
      const values = data?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
      if (!Array.isArray(values)) continue;

      // e-StatのVALUEは配列で、各要素に $（値）と時間キーがある
      for (const v of values.slice(0, 12)) {
        const value = parseFloat(v.$);
        if (isNaN(value)) continue;
        // 時間キーはデータにより異なる（@time, @cat01 等）
        const timeKey = v["@time"] ?? v["@tab"] ?? "";
        results.push({
          indicator: stat.statsDataId,
          indicator_label: stat.label,
          date: String(timeKey),
          value,
          unit: stat.unit,
        });
      }
    } catch (e) {
      console.error(`e-Stat fetch error for ${stat.label}:`, e);
    }
  }

  return results;
}

// ============================================================
// 異常値検出（全ソース統合）
// ============================================================
export function detectAnomalies(
  gdeltData: GdeltToneData[],
  worldbankData: WorldBankDataPoint[] = [],
  _estatData: EStatDataPoint[] = [],
): OsintAnomaly[] {
  const anomalies: OsintAnomaly[] = [];

  // GDELT: トーンの急変
  for (const d of gdeltData) {
    if (d.is_anomaly) {
      anomalies.push({
        theme: d.theme,
        source: "gdelt",
        type: "tone_shift",
        detail: `${d.theme}のメディアトーンが7日平均比${d.tone_change_pct > 0 ? "+" : ""}${d.tone_change_pct.toFixed(1)}%変化（${d.avg_tone_7d.toFixed(2)} → ${d.latest_tone.toFixed(2)}）`,
        severity: Math.abs(d.tone_change_pct) > 100 ? "high" : "medium",
        current_value: d.latest_tone,
        baseline_value: d.avg_tone_7d,
        change_pct: d.tone_change_pct,
      });
    }
  }

  // World Bank: 前年比での大きな変化（GDP成長率が2ポイント以上変動）
  const wbByCountryIndicator = new Map<string, WorldBankDataPoint[]>();
  for (const dp of worldbankData) {
    const key = `${dp.country_code}:${dp.indicator_id}`;
    if (!wbByCountryIndicator.has(key)) wbByCountryIndicator.set(key, []);
    wbByCountryIndicator.get(key)!.push(dp);
  }

  for (const [, points] of wbByCountryIndicator) {
    const sorted = points.sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) continue;
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    if (latest.value === null || prev.value === null) continue;

    const diff = Math.abs(latest.value - prev.value);
    if (diff >= 2) {
      const themeMap: Record<string, ThemeId> = {
        "NY.GDP.MKTP.KD.ZG": "economic_policy",
        "FP.CPI.TOTL.ZG": "economic_policy",
      };
      anomalies.push({
        theme: themeMap[latest.indicator_id] ?? "economic_policy",
        source: "worldbank",
        type: "indicator_change",
        detail: `${latest.country}の${latest.indicator_label}が${prev.date}→${latest.date}で${prev.value.toFixed(1)}→${latest.value.toFixed(1)}に変化`,
        severity: diff >= 4 ? "high" : "medium",
        current_value: latest.value,
        baseline_value: prev.value,
        change_pct: prev.value !== 0 ? ((latest.value - prev.value) / Math.abs(prev.value)) * 100 : 0,
      });
    }
  }

  return anomalies;
}
