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
// World Bank 直接API — マクロ経済データ（APIキー不要）
// DBnomicsより鮮度が高い（2024年データあり）
// ============================================================
const WB_BASE = "https://api.worldbank.org/v2";

const WB_INDICATORS: { id: string; label: string; category: OsintDataPoint["category"] }[] = [
  { id: "NY.GDP.MKTP.KD.ZG", label: "GDP成長率", category: "macro" },
  { id: "FP.CPI.TOTL.ZG", label: "CPI上昇率", category: "price" },
  { id: "NE.TRD.GNFS.ZS", label: "貿易/GDP比", category: "trade" },
  { id: "BX.KLT.DINV.WD.GD.ZS", label: "FDI流入/GDP比", category: "trade" },
  // SIPRI軍事費データ（World Bank経由）
  { id: "MS.MIL.XPND.GD.ZS", label: "軍事費/GDP比", category: "military" },
  { id: "MS.MIL.XPND.CD", label: "軍事費（USD）", category: "military" },
];

const WB_COUNTRIES: { code: string; label: string }[] = [
  { code: "USA", label: "米国" },
  { code: "JPN", label: "日本" },
  { code: "CHN", label: "中国" },
  { code: "DEU", label: "ドイツ" },
  { code: "IND", label: "インド" },
  { code: "BRA", label: "ブラジル" },
];

const COUNTRY_LABELS = Object.fromEntries(WB_COUNTRIES.map((c) => [c.code, c.label]));

export async function fetchWorldBankDirect(): Promise<OsintDataPoint[]> {
  const currentYear = new Date().getFullYear();
  const countryCodes = WB_COUNTRIES.map((c) => c.code).join(";");
  const results: OsintDataPoint[] = [];

  const promises = WB_INDICATORS.map(async (ind) => {
    try {
      const url = `${WB_BASE}/country/${countryCodes}/indicator/${ind.id}?date=${currentYear - 3}:${currentYear}&format=json&per_page=100`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const data = await res.json();
      const entries = data?.[1] ?? [];

      // 国ごとに最新のnon-null値を取得
      const byCountry = new Map<string, { date: string; value: number }>();
      for (const e of entries) {
        if (e.value === null) continue;
        const cc = e.country?.id ?? "";
        const existing = byCountry.get(cc);
        if (!existing || e.date > existing.date) {
          byCountry.set(cc, { date: e.date, value: e.value });
        }
      }

      const points: OsintDataPoint[] = [];
      for (const [cc, { date, value }] of byCountry) {
        points.push({
          source: "dbnomics", // 互換性のため同じソース名を維持
          category: ind.category,
          indicator: ind.id,
          label: `${COUNTRY_LABELS[cc] ?? cc}${ind.label}`,
          value,
          date,
          country: cc,
          unit: "%",
        });
      }
      return points;
    } catch { return []; }
  });

  const allResults = await Promise.all(promises);
  for (const r of allResults) results.push(...r);
  return results;
}

// ============================================================
// USGS Earthquake — 地震データ（APIキー不要）
// ============================================================
const USGS_BASE = "https://earthquake.usgs.gov/fdsnws/event/1";

export async function fetchUSGSEarthquake(): Promise<OsintDataPoint[]> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const from = weekAgo.toISOString().split("T")[0];
  const to = now.toISOString().split("T")[0];

  try {
    // M4.5+の件数
    const countUrl = `${USGS_BASE}/count?format=geojson&starttime=${from}&endtime=${to}&minmagnitude=4.5`;
    const countRes = await fetch(countUrl, { signal: AbortSignal.timeout(8000) });
    if (!countRes.ok) return [];
    const countData = await countRes.json();
    const totalCount = countData?.count ?? 0;

    // M4.5+の詳細（上位20件、マグニチュード順）
    const queryUrl = `${USGS_BASE}/query?format=geojson&starttime=${from}&endtime=${to}&minmagnitude=4.5&orderby=magnitude&limit=20`;
    const queryRes = await fetch(queryUrl, { signal: AbortSignal.timeout(8000) });
    if (!queryRes.ok) {
      return [{
        source: "usgs", category: "disaster", indicator: "earthquake_m45_total",
        label: `M4.5+地震件数（直近7日）`, value: totalCount, date: to, unit: "件",
      }];
    }
    const queryData = await queryRes.json();
    const features = queryData?.features ?? [];

    // 地域別集計
    const regionCounts: Record<string, number> = {};
    let maxMag = 0;
    let maxPlace = "";
    for (const f of features) {
      const mag = f.properties?.mag ?? 0;
      const place = f.properties?.place ?? "Unknown";
      if (mag > maxMag) { maxMag = mag; maxPlace = place; }
      // 地域を大まかに分類（経度ベース）
      const lon = f.geometry?.coordinates?.[0] ?? 0;
      const lat = f.geometry?.coordinates?.[1] ?? 0;
      const region = classifyRegion(lat, lon);
      regionCounts[region] = (regionCounts[region] ?? 0) + 1;
    }

    const results: OsintDataPoint[] = [
      {
        source: "usgs", category: "disaster", indicator: "earthquake_m45_total",
        label: `M4.5+地震件数（直近7日）`, value: totalCount, date: to, unit: "件",
      },
      {
        source: "usgs", category: "disaster", indicator: "earthquake_max_magnitude",
        label: `最大マグニチュード（${maxPlace}）`, value: maxMag, date: to, unit: "M",
      },
    ];

    // M6+件数
    const m6Count = features.filter((f: { properties?: { mag?: number } }) => (f.properties?.mag ?? 0) >= 6).length;
    if (m6Count > 0) {
      results.push({
        source: "usgs", category: "disaster", indicator: "earthquake_m6_count",
        label: `M6.0+地震件数（直近7日）`, value: m6Count, date: to, unit: "件",
      });
    }

    for (const [region, count] of Object.entries(regionCounts)) {
      results.push({
        source: "usgs", category: "disaster",
        indicator: `earthquake_${region.toLowerCase().replace(/\s/g, "_")}`,
        label: `${region}地震件数（直近7日）`, value: count, date: to, country: region, unit: "件",
      });
    }

    return results;
  } catch {
    return [];
  }
}

function classifyRegion(lat: number, lon: number): string {
  if (lat > 15 && lat < 50 && lon > 25 && lon < 65) return "中東";
  if (lat > 35 && lat < 72 && lon > -25 && lon < 40) return "欧州";
  if (lat > -10 && lat < 55 && lon > 65 && lon < 180) return "アジア太平洋";
  if (lat > -35 && lat < 37 && lon > -20 && lon < 55) return "アフリカ";
  if (lon > -170 && lon < -30) return "南北米";
  return "その他";
}

// ============================================================
// FAO Food Price Index — 食料価格指数（APIキー不要）
// ============================================================
const FAO_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export async function fetchFAOFoodPrice(): Promise<OsintDataPoint[]> {
  const now = new Date();

  // 最新月のCSVを取得（当月→前月→前々月の順で試行）
  for (let offset = 0; offset < 3; offset++) {
    const target = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthStr = FAO_MONTHS[target.getMonth()];
    const url = `https://www.fao.org/media/docs/worldfoodsituationlibraries/default-document-library/food_price_indices_data_csv_${monthStr}.csv`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const text = await res.text();
      return parseFAOCsv(text);
    } catch {
      continue;
    }
  }
  return [];
}

function parseFAOCsv(text: string): OsintDataPoint[] {
  const lines = text.split("\n").filter((l) => l.trim());
  // ヘッダー行を探す（"Date" を含む行）
  const headerIdx = lines.findIndex((l) => l.includes("Date") && l.includes("Food Price Index"));
  if (headerIdx < 0) return [];

  const headers = lines[headerIdx].split(",").map((h) => h.trim());
  // 最新3行分のデータを取得
  const dataLines = lines.slice(headerIdx + 1).filter((l) => l.trim() && !l.startsWith(","));
  const recent = dataLines.slice(-3);

  const results: OsintDataPoint[] = [];
  for (const line of recent) {
    const cols = line.split(",").map((c) => c.trim());
    const date = cols[0] ?? "";
    // "2026-02" のような形式に変換
    const dateNorm = date.includes("/")
      ? `${date.split("/")[0]}-${date.split("/")[1]?.padStart(2, "0")}`
      : date;

    const indices = [
      { col: "Food Price Index", indicator: "fao_food_price", label: "FAO食料価格指数（総合）" },
      { col: "Meat", indicator: "fao_meat", label: "FAO食肉価格指数" },
      { col: "Dairy", indicator: "fao_dairy", label: "FAO乳製品価格指数" },
      { col: "Cereals", indicator: "fao_cereals", label: "FAO穀物価格指数" },
      { col: "Oils", indicator: "fao_oils", label: "FAO油脂価格指数" },
      { col: "Sugar", indicator: "fao_sugar", label: "FAO砂糖価格指数" },
    ];

    for (const idx of indices) {
      const colIdx = headers.indexOf(idx.col);
      if (colIdx < 0) continue;
      const val = parseFloat(cols[colIdx]);
      if (isNaN(val)) continue;
      results.push({
        source: "fao", category: "price", indicator: idx.indicator,
        label: idx.label, value: val, date: dateNorm, unit: "指数",
      });
    }
  }
  return results;
}

// ============================================================
// OpenSanctions — 制裁対象データ統計（APIキー不要: /catalog）
// ============================================================
export async function fetchOpenSanctions(): Promise<OsintDataPoint[]> {
  try {
    const res = await fetch("https://api.opensanctions.org/catalog", {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const datasets = data?.datasets ?? data;

    const today = new Date().toISOString().split("T")[0];
    const results: OsintDataPoint[] = [];

    // 主要データセットの統計を取得
    const targets: { name: string; label: string }[] = [
      { name: "default", label: "OpenSanctions全エンティティ数" },
      { name: "sanctions", label: "制裁対象エンティティ数" },
      { name: "peps", label: "PEPs（重要公的地位者）数" },
      { name: "crime", label: "犯罪関連エンティティ数" },
    ];

    for (const t of targets) {
      const ds = Array.isArray(datasets)
        ? datasets.find((d: { name?: string }) => d.name === t.name)
        : datasets[t.name];
      if (!ds) continue;
      const count = ds.thing_count ?? ds.entity_count ?? ds.targets?.count ?? 0;
      if (count > 0) {
        results.push({
          source: "opensanctions", category: "sanctions", indicator: `osanc_${t.name}`,
          label: t.label, value: count, date: ds.last_export?.split("T")?.[0] ?? today, unit: "件",
        });
      }
    }

    return results;
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
// 消費者物価指数: statsDataId=0003427113
// cdCat01=0001 → 総合, cdArea=00000 → 全国
function parseEStatTime(timeCode: string): string {
  // "2025000101" → "2025-01", "2025000601" → "2025-06"
  if (timeCode.length >= 10) {
    const year = timeCode.slice(0, 4);
    const month = timeCode.slice(6, 8);
    return `${year}-${month}`;
  }
  return timeCode;
}

export async function fetchEStatData(): Promise<OsintDataPoint[]> {
  const apiKey = process.env.ESTAT_API_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${apiKey}&statsDataId=0003427113&cdCat01=0001&cdArea=00000&limit=24&metaGetFlg=N&sectionHeaderFlg=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.error(`e-Stat API error: ${res.status}`);
      return [];
    }
    const data = await res.json();

    // エラーチェック
    const status = data?.GET_STATS_DATA?.RESULT?.STATUS;
    if (status && status !== 0) {
      console.error(`e-Stat error: ${data?.GET_STATS_DATA?.RESULT?.ERROR_MSG}`);
      return [];
    }

    const values = data?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
    if (!Array.isArray(values)) return [];

    const results: OsintDataPoint[] = [];
    for (const v of values) {
      const raw = v["$"];
      if (raw === undefined || raw === null || raw === "-" || raw === "…") continue;
      const value = parseFloat(String(raw));
      if (isNaN(value)) continue;
      const timeCode = v["@time"] ?? "";
      const date = parseEStatTime(String(timeCode));
      results.push({
        source: "estat", category: "price",
        indicator: "cpi_total", label: "消費者物価指数（総合・全国）",
        value, date, country: "JPN", unit: "指数",
      });
    }

    // 最新12ヶ月分を返す（降順ソートして上位12件）
    results.sort((a, b) => b.date.localeCompare(a.date));
    return results.slice(0, 12);
  } catch (e) {
    console.error("e-Stat fetch error:", e);
    return [];
  }
}

// ============================================================
// 全データソース並列取得
// ============================================================
export async function fetchAllDataSources(): Promise<OsintDataPoint[]> {
  const [worldbank, fred, edinet, estat, usgs, fao, opensanctions] = await Promise.all([
    fetchWorldBankDirect().catch(() => [] as OsintDataPoint[]),
    fetchFRED().catch(() => [] as OsintDataPoint[]),
    fetchEDINET().catch(() => [] as OsintDataPoint[]),
    fetchEStatData().catch(() => [] as OsintDataPoint[]),
    fetchUSGSEarthquake().catch(() => [] as OsintDataPoint[]),
    fetchFAOFoodPrice().catch(() => [] as OsintDataPoint[]),
    fetchOpenSanctions().catch(() => [] as OsintDataPoint[]),
  ]);
  return [...worldbank, ...fred, ...edinet, ...estat, ...usgs, ...fao, ...opensanctions];
}

// ============================================================
// 異常値検出（全ソース統合）
// ============================================================

/** データが直近1年以内かどうか */
function isRecent(dateStr: string, maxAgeMonths = 12): boolean {
  const now = new Date();
  // "2023" のような年だけの場合も、"2023-06" や "2023-06-15" もパース
  const parsed = new Date(dateStr.length === 4 ? `${dateStr}-07-01` : dateStr);
  if (isNaN(parsed.getTime())) return false;
  const diffMs = now.getTime() - parsed.getTime();
  return diffMs < maxAgeMonths * 30 * 24 * 60 * 60 * 1000;
}

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

  // DBnomics: 直近1年以内のデータのみ異常値検出
  const recentGdp = dataPoints.filter(
    (dp) => dp.source === "dbnomics" && dp.label.includes("GDP") && dp.value !== null && isRecent(dp.date)
  );
  for (const dp of recentGdp) {
    if (dp.value !== null && (dp.value < -2 || dp.value > 8)) {
      anomalies.push({
        theme: "economic_policy", source: "dbnomics", type: "indicator_change",
        detail: `${dp.label}が${dp.date}時点で${dp.value.toFixed(1)}%（通常範囲外）`,
        severity: Math.abs(dp.value) > 5 ? "high" : "medium",
        current_value: dp.value, baseline_value: 2.5, change_pct: 0,
      });
    }
  }

  // FRED: 金利の急変（直近データのみ）
  const fredRate = dataPoints.find(
    (dp) => dp.indicator === "FEDFUNDS" && isRecent(dp.date, 1)
  );
  const fredPrev = dataPoints.find(
    (dp) => dp.indicator === "DGS10" && isRecent(dp.date, 1)
  );
  if (fredRate?.value !== null && fredRate?.value !== undefined && fredRate.value > 6) {
    anomalies.push({
      theme: "financial_system", source: "fred", type: "indicator_change",
      detail: `FF金利が${fredRate.value.toFixed(2)}%（高水準）`,
      severity: "high",
      current_value: fredRate.value, baseline_value: 5.0, change_pct: 0,
    });
  }

  // USGS: M6+地震が発生した場合
  const earthquakeM6 = dataPoints.find((dp) => dp.indicator === "earthquake_m6_count");
  if (earthquakeM6?.value !== null && earthquakeM6?.value !== undefined && earthquakeM6.value > 0) {
    anomalies.push({
      theme: "geopolitics", source: "usgs", type: "earthquake_spike",
      detail: `直近7日間にM6.0+地震が${earthquakeM6.value}件発生`,
      severity: earthquakeM6.value >= 3 ? "high" : "medium",
      current_value: earthquakeM6.value, baseline_value: 0, change_pct: 0,
    });
  }

  // USGS: M4.5+の週間件数が異常に多い場合（通常100前後）
  const earthquakeTotal = dataPoints.find((dp) => dp.indicator === "earthquake_m45_total");
  if (earthquakeTotal?.value !== null && earthquakeTotal?.value !== undefined && earthquakeTotal.value > 200) {
    anomalies.push({
      theme: "geopolitics", source: "usgs", type: "earthquake_spike",
      detail: `M4.5+地震が直近7日間で${earthquakeTotal.value}件（通常の約2倍）`,
      severity: earthquakeTotal.value > 300 ? "high" : "medium",
      current_value: earthquakeTotal.value, baseline_value: 100, change_pct: 0,
    });
  }

  // FAO: 食料価格指数が急騰（2014-16基準=100、150超で警告）
  const faoFood = dataPoints.find((dp) => dp.indicator === "fao_food_price");
  if (faoFood?.value !== null && faoFood?.value !== undefined && faoFood.value > 150) {
    anomalies.push({
      theme: "food_supply", source: "fao", type: "indicator_change",
      detail: `FAO食料価格指数が${faoFood.value.toFixed(1)}（基準100、高水準）`,
      severity: faoFood.value > 170 ? "high" : "medium",
      current_value: faoFood.value, baseline_value: 100, change_pct: 0,
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
