import type { ThemeId, GdeltToneData, OsintAnomaly, OsintDataPoint } from "./types";

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
        ? prev7.reduce((sum, d) => sum + d.tone, 0) / prev7.length : 0;
      const toneChange = Math.abs(avgTone) > 0.01
        ? ((latest.tone - avgTone) / Math.abs(avgTone)) * 100 : 0;
      return {
        theme, query, daily_tone: daily,
        latest_tone: latest.tone, avg_tone_7d: avgTone,
        tone_change_pct: toneChange, is_anomaly: Math.abs(toneChange) > 50,
      } satisfies GdeltToneData;
    } catch { return null; }
  });
  const results = await Promise.all(promises);
  return results.filter((r): r is GdeltToneData => r !== null);
}

// ============================================================
// DBnomics — 統合マクロ経済データ（APIキー不要）
// World Bank / IMF / BIS / UNCTAD を1つのAPIで取得
// ============================================================
const DBNOMICS_BASE = "https://api.db.nomics.world/v22";

const DBNOMICS_SERIES: { id: string; label: string; category: OsintDataPoint["category"]; country: string }[] = [
  // World Bank — GDP成長率
  { id: "WB/WDI/A-NY.GDP.MKTP.KD.ZG-USA", label: "米国GDP成長率", category: "macro", country: "USA" },
  { id: "WB/WDI/A-NY.GDP.MKTP.KD.ZG-JPN", label: "日本GDP成長率", category: "macro", country: "JPN" },
  { id: "WB/WDI/A-NY.GDP.MKTP.KD.ZG-CHN", label: "中国GDP成長率", category: "macro", country: "CHN" },
  { id: "WB/WDI/A-NY.GDP.MKTP.KD.ZG-DEU", label: "ドイツGDP成長率", category: "macro", country: "DEU" },
  { id: "WB/WDI/A-NY.GDP.MKTP.KD.ZG-IND", label: "インドGDP成長率", category: "macro", country: "IND" },
  { id: "WB/WDI/A-NY.GDP.MKTP.KD.ZG-BRA", label: "ブラジルGDP成長率", category: "macro", country: "BRA" },
  // World Bank — CPI
  { id: "WB/WDI/A-FP.CPI.TOTL.ZG-USA", label: "米国CPI上昇率", category: "price", country: "USA" },
  { id: "WB/WDI/A-FP.CPI.TOTL.ZG-JPN", label: "日本CPI上昇率", category: "price", country: "JPN" },
  { id: "WB/WDI/A-FP.CPI.TOTL.ZG-CHN", label: "中国CPI上昇率", category: "price", country: "CHN" },
  // World Bank — 貿易（GDP比）
  { id: "WB/WDI/A-NE.TRD.GNFS.ZS-USA", label: "米国貿易/GDP比", category: "trade", country: "USA" },
  { id: "WB/WDI/A-NE.TRD.GNFS.ZS-JPN", label: "日本貿易/GDP比", category: "trade", country: "JPN" },
  { id: "WB/WDI/A-NE.TRD.GNFS.ZS-CHN", label: "中国貿易/GDP比", category: "trade", country: "CHN" },
  // World Bank — FDI（GDP比）= UNCTAD相当
  { id: "WB/WDI/A-BX.KLT.DINV.WD.GD.ZS-USA", label: "米国FDI流入/GDP比", category: "trade", country: "USA" },
  { id: "WB/WDI/A-BX.KLT.DINV.WD.GD.ZS-JPN", label: "日本FDI流入/GDP比", category: "trade", country: "JPN" },
  { id: "WB/WDI/A-BX.KLT.DINV.WD.GD.ZS-IND", label: "インドFDI流入/GDP比", category: "trade", country: "IND" },
  { id: "WB/WDI/A-BX.KLT.DINV.WD.GD.ZS-BRA", label: "ブラジルFDI流入/GDP比", category: "trade", country: "BRA" },
];

export async function fetchDBnomics(): Promise<OsintDataPoint[]> {
  const results: OsintDataPoint[] = [];
  // バッチで取得（5件ずつ）
  const batchSize = 5;
  for (let i = 0; i < DBNOMICS_SERIES.length; i += batchSize) {
    const batch = DBNOMICS_SERIES.slice(i, i + batchSize);
    const promises = batch.map(async (s) => {
      try {
        const url = `${DBNOMICS_BASE}/series/${s.id}?observations=1&format=json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const data = await res.json();
        const series = data?.series?.docs?.[0];
        if (!series) return null;
        const periods = series.period ?? [];
        const values = series.value ?? [];
        if (periods.length === 0) return null;
        const lastIdx = periods.length - 1;
        return {
          source: "dbnomics" as const,
          category: s.category,
          indicator: s.id,
          label: s.label,
          value: typeof values[lastIdx] === "number" ? values[lastIdx] : null,
          date: String(periods[lastIdx]),
          country: s.country,
          unit: "%",
        } satisfies OsintDataPoint;
      } catch { return null; }
    });
    const batchResults = await Promise.all(promises);
    for (const r of batchResults) { if (r) results.push(r); }
  }
  return results;
}

// ============================================================
// ACLED — 紛争・抗議活動データ（ACLED_API_KEY + ACLED_EMAIL 必要）
// ============================================================
export async function fetchACLED(): Promise<OsintDataPoint[]> {
  const apiKey = process.env.ACLED_API_KEY;
  const email = process.env.ACLED_EMAIL;
  if (!apiKey || !email) return [];

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const from = weekAgo.toISOString().split("T")[0];
    const to = now.toISOString().split("T")[0];

    const url = `https://api.acleddata.com/acled/read?key=${apiKey}&email=${encodeURIComponent(email)}&event_date=${from}|${to}&event_date_where=BETWEEN&limit=0`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();

    const totalEvents = data?.count ?? 0;

    // 地域別の集計も取得
    const regions = ["Middle East", "Europe", "Asia", "Africa", "Americas"];
    const regionResults: OsintDataPoint[] = [
      {
        source: "acled", category: "conflict", indicator: "acled_total_events",
        label: `紛争・抗議イベント総数（直近7日）`, value: totalEvents,
        date: to, unit: "件",
      },
    ];

    // 主要地域のイベント数を個別取得（並列）
    const regionPromises = regions.map(async (region) => {
      try {
        const rUrl = `https://api.acleddata.com/acled/read?key=${apiKey}&email=${encodeURIComponent(email)}&event_date=${from}|${to}&event_date_where=BETWEEN&region=${encodeURIComponent(region)}&limit=0`;
        const rRes = await fetch(rUrl, { signal: AbortSignal.timeout(5000) });
        if (!rRes.ok) return null;
        const rData = await rRes.json();
        return {
          source: "acled" as const, category: "conflict" as const,
          indicator: `acled_${region.toLowerCase().replace(/\s/g, "_")}`,
          label: `${region}紛争イベント数（直近7日）`,
          value: rData?.count ?? 0, date: to, country: region, unit: "件",
        } satisfies OsintDataPoint;
      } catch { return null; }
    });
    const regionData = await Promise.all(regionPromises);
    for (const r of regionData) { if (r) regionResults.push(r); }
    return regionResults;
  } catch {
    return [];
  }
}

// ============================================================
// FRED — 米国金融指標（FRED_API_KEY 必要）
// ============================================================
const FRED_SERIES: { id: string; label: string; category: OsintDataPoint["category"]; unit: string }[] = [
  { id: "FEDFUNDS", label: "FF金利", category: "finance", unit: "%" },
  { id: "DGS10", label: "米10年国債利回り", category: "finance", unit: "%" },
  { id: "T10YIE", label: "10年BEI（期待インフレ率）", category: "price", unit: "%" },
  { id: "UNRATE", label: "米国失業率", category: "macro", unit: "%" },
  { id: "DTWEXBGS", label: "米ドル実効為替レート", category: "finance", unit: "指数" },
];

export async function fetchFRED(): Promise<OsintDataPoint[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return [];

  const promises = FRED_SERIES.map(async (s) => {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${apiKey}&file_type=json&limit=2&sort_order=desc`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const data = await res.json();
      const obs = data?.observations?.[0];
      if (!obs || obs.value === ".") return null;
      return {
        source: "fred" as const, category: s.category,
        indicator: s.id, label: s.label,
        value: parseFloat(obs.value), date: obs.date,
        country: "USA", unit: s.unit,
      } satisfies OsintDataPoint;
    } catch { return null; }
  });

  const results = await Promise.all(promises);
  const filtered: OsintDataPoint[] = [];
  for (const r of results) { if (r) filtered.push(r); }
  return filtered;
}

// ============================================================
// EDINET — 日本の有価証券報告書・大量保有報告（APIキー不要）
// ============================================================
export async function fetchEDINET(): Promise<OsintDataPoint[]> {
  try {
    const today = new Date().toISOString().split("T")[0];
    // type=2: 有価証券報告書等
    const url = `https://api.edinet-fsa.go.jp/api/v2/documents.json?date=${today}&type=2`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const results = data?.results ?? [];

    // カテゴリ別集計
    const counts: Record<string, number> = {};
    for (const doc of results) {
      const desc = doc.docDescription ?? "その他";
      const category = desc.includes("有価証券報告書") ? "有価証券報告書"
        : desc.includes("大量保有") ? "大量保有報告書"
        : desc.includes("四半期") ? "四半期報告書"
        : "その他";
      counts[category] = (counts[category] ?? 0) + 1;
    }

    const dataPoints: OsintDataPoint[] = [
      {
        source: "edinet", category: "filing", indicator: "edinet_total",
        label: `EDINET提出書類数（${today}）`, value: results.length,
        date: today, country: "JPN", unit: "件",
      },
    ];

    for (const [cat, count] of Object.entries(counts)) {
      dataPoints.push({
        source: "edinet", category: "filing",
        indicator: `edinet_${cat}`, label: `${cat}（${today}）`,
        value: count, date: today, country: "JPN", unit: "件",
      });
    }

    return dataPoints;
  } catch {
    return [];
  }
}

// ============================================================
// e-Stat — 日本政府統計（ESTAT_API_KEY 必要）
// ============================================================
export async function fetchEStatData(): Promise<OsintDataPoint[]> {
  const apiKey = process.env.ESTAT_API_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${apiKey}&statsDataId=0003421913&limit=12&startPosition=1&metaGetFlg=N&sectionHeaderFlg=2`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    const values = data?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
    if (!Array.isArray(values)) return [];

    const results: OsintDataPoint[] = [];
    for (const v of values.slice(0, 12)) {
      const value = parseFloat(v.$);
      if (isNaN(value)) continue;
      const timeKey = v["@time"] ?? v["@tab"] ?? "";
      results.push({
        source: "estat", category: "price",
        indicator: "cpi_total", label: "消費者物価指数（総合）",
        value, date: String(timeKey), country: "JPN", unit: "指数",
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ============================================================
// 全データソース並列取得
// ============================================================
export async function fetchAllDataSources(): Promise<OsintDataPoint[]> {
  const [dbnomics, acled, fred, edinet, estat] = await Promise.all([
    fetchDBnomics().catch(() => [] as OsintDataPoint[]),
    fetchACLED().catch(() => [] as OsintDataPoint[]),
    fetchFRED().catch(() => [] as OsintDataPoint[]),
    fetchEDINET().catch(() => [] as OsintDataPoint[]),
    fetchEStatData().catch(() => [] as OsintDataPoint[]),
  ]);
  return [...dbnomics, ...acled, ...fred, ...edinet, ...estat];
}

// ============================================================
// 異常値検出（全ソース統合）
// ============================================================
export function detectAnomalies(
  gdeltData: GdeltToneData[],
  dataPoints: OsintDataPoint[] = [],
): OsintAnomaly[] {
  const anomalies: OsintAnomaly[] = [];

  // GDELT: トーンの急変
  for (const d of gdeltData) {
    if (d.is_anomaly) {
      anomalies.push({
        theme: d.theme, source: "gdelt", type: "tone_shift",
        detail: `${d.theme}のメディアトーンが7日平均比${d.tone_change_pct > 0 ? "+" : ""}${d.tone_change_pct.toFixed(1)}%変化（${d.avg_tone_7d.toFixed(2)} → ${d.latest_tone.toFixed(2)}）`,
        severity: Math.abs(d.tone_change_pct) > 100 ? "high" : "medium",
        current_value: d.latest_tone, baseline_value: d.avg_tone_7d,
        change_pct: d.tone_change_pct,
      });
    }
  }

  // DBnomics: GDP成長率の急変（前年比2ポイント以上の変化を検出）
  const gdpPoints = dataPoints.filter((dp) => dp.source === "dbnomics" && dp.label.includes("GDP"));
  const gdpByCountry = new Map<string, OsintDataPoint[]>();
  for (const dp of gdpPoints) {
    const key = dp.country ?? "unknown";
    if (!gdpByCountry.has(key)) gdpByCountry.set(key, []);
    gdpByCountry.get(key)!.push(dp);
  }
  // Note: DBnomics returns latest observation only, so cross-year comparison
  // requires historical data. For now, flag extreme values.
  for (const dp of gdpPoints) {
    if (dp.value !== null && (dp.value < -2 || dp.value > 8)) {
      anomalies.push({
        theme: "economic_policy", source: "dbnomics", type: "indicator_change",
        detail: `${dp.label}が${dp.date}時点で${dp.value?.toFixed(1)}%（通常範囲外）`,
        severity: Math.abs(dp.value) > 5 ? "high" : "medium",
        current_value: dp.value, baseline_value: 2.5, change_pct: 0,
      });
    }
  }

  // ACLED: 紛争イベント数が多い場合
  const acledTotal = dataPoints.find((dp) => dp.indicator === "acled_total_events");
  if (acledTotal?.value !== null && acledTotal?.value !== undefined && acledTotal.value > 500) {
    anomalies.push({
      theme: "geopolitics", source: "acled", type: "conflict_spike",
      detail: `直近7日間の紛争・抗議イベントが${acledTotal.value}件（高水準）`,
      severity: acledTotal.value > 1000 ? "high" : "medium",
      current_value: acledTotal.value, baseline_value: 300, change_pct: 0,
    });
  }

  // EDINET: 提出数が多い日（通常比2倍以上）
  const edinetTotal = dataPoints.find((dp) => dp.indicator === "edinet_total");
  if (edinetTotal?.value !== null && edinetTotal?.value !== undefined && edinetTotal.value > 100) {
    anomalies.push({
      theme: "financial_system", source: "edinet", type: "filing_surge",
      detail: `EDINET提出書類数が${edinetTotal.value}件（通常の約50件を大幅超過）`,
      severity: edinetTotal.value > 200 ? "high" : "medium",
      current_value: edinetTotal.value, baseline_value: 50, change_pct: 0,
    });
  }

  return anomalies;
}
