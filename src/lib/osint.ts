import type { ThemeId, GdeltToneData, OsintAnomaly } from "./types";

const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

// 6テーマのGDELTクエリ（最もOSINTデータと相性が良いテーマ）
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

export function detectAnomalies(gdeltData: GdeltToneData[]): OsintAnomaly[] {
  return gdeltData
    .filter((d) => d.is_anomaly)
    .map((d) => ({
      theme: d.theme,
      type: "tone_shift" as const,
      detail: `${d.theme}のメディアトーンが7日平均比${d.tone_change_pct > 0 ? "+" : ""}${d.tone_change_pct.toFixed(1)}%変化（${d.avg_tone_7d.toFixed(2)} → ${d.latest_tone.toFixed(2)}）`,
      severity: (Math.abs(d.tone_change_pct) > 100 ? "high" : "medium") as "high" | "medium",
      current_value: d.latest_tone,
      baseline_value: d.avg_tone_7d,
      change_pct: d.tone_change_pct,
    }));
}
