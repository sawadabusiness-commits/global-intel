import type { IntelligenceMemory, KeyIndicatorTracker, OsintDataPoint, OsintAnomaly, AnalyzedArticle, ThemeNarrative, ThemeId, WeeklyMemorySummary } from "./types";

// 追跡する主要指標の定義
const TRACKED_INDICATORS: { indicator: string; source: string; label: string }[] = [
  { indicator: "FEDFUNDS", source: "fred", label: "FF金利" },
  { indicator: "DGS10", source: "fred", label: "米10年国債利回り" },
  { indicator: "UNRATE", source: "fred", label: "米失業率" },
  { indicator: "DTWEXBGS", source: "fred", label: "ドル指数" },
  { indicator: "IRSTCI01JPM156N", source: "fred", label: "日本短期金利" },
  { indicator: "IRLTLT01JPM156N", source: "fred", label: "日本10年JGB" },
  { indicator: "fao_food_price_index", source: "fao", label: "FAO食料価格指数" },
  { indicator: "earthquake_m45_count", source: "usgs", label: "M4.5+地震件数" },
];

function computeTrend(history: { date: string; value: number }[]): "rising" | "falling" | "stable" {
  if (history.length < 2) return "stable";
  const recent = history.slice(-3);
  let ups = 0;
  let downs = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].value > recent[i - 1].value) ups++;
    else if (recent[i].value < recent[i - 1].value) downs++;
  }
  if (ups > downs) return "rising";
  if (downs > ups) return "falling";
  return "stable";
}

export function updateKeyIndicators(
  currentMemory: IntelligenceMemory | null,
  todayDataPoints: OsintDataPoint[],
  today: string,
): KeyIndicatorTracker[] {
  const existing = new Map(
    (currentMemory?.key_indicators ?? []).map((k) => [k.indicator, k]),
  );

  const dpMap = new Map<string, OsintDataPoint>();
  for (const dp of todayDataPoints) {
    // FRED/FAO/USGSの指標をマッチング
    const key = dp.indicator;
    if (!dpMap.has(key)) dpMap.set(key, dp);
  }

  const result: KeyIndicatorTracker[] = [];

  for (const spec of TRACKED_INDICATORS) {
    const dp = dpMap.get(spec.indicator);
    if (!dp || dp.value == null) {
      // データがない場合、既存のトラッカーをそのまま引き継ぎ
      const prev = existing.get(spec.indicator);
      if (prev) result.push(prev);
      continue;
    }

    const prev = existing.get(spec.indicator);
    const previousValue = prev?.current_value ?? null;
    const change = previousValue != null ? dp.value - previousValue : null;
    const changePct = previousValue != null && previousValue !== 0
      ? ((dp.value - previousValue) / Math.abs(previousValue)) * 100
      : null;

    const history = [...(prev?.history ?? [])];
    // 同じ日付のエントリがあれば上書き
    const existingIdx = history.findIndex((h) => h.date === today);
    if (existingIdx >= 0) {
      history[existingIdx] = { date: today, value: dp.value };
    } else {
      history.push({ date: today, value: dp.value });
    }
    // 直近7日分のみ保持
    while (history.length > 7) history.shift();

    result.push({
      indicator: spec.indicator,
      source: spec.source,
      label: spec.label,
      current_value: dp.value,
      previous_value: previousValue,
      change,
      change_pct: changePct != null ? Math.round(changePct * 100) / 100 : null,
      trend: computeTrend(history),
      history,
      first_seen: prev?.first_seen ?? today,
      last_updated: today,
    });
  }

  return result;
}

// ANALYST4/5向け: 指標変動のテキスト生成
export function formatIndicatorContext(indicators: KeyIndicatorTracker[]): string {
  if (indicators.length === 0) return "";

  const lines = indicators
    .filter((k) => k.change != null)
    .map((k) => {
      const dir = k.change! > 0 ? "+" : "";
      const trendJa = k.trend === "rising" ? "上昇傾向" : k.trend === "falling" ? "下落傾向" : "横ばい";
      return `${k.label}: ${k.current_value}（前日比${dir}${k.change!.toFixed(2)}、${dir}${k.change_pct!.toFixed(1)}%、${trendJa}）`;
    });

  if (lines.length === 0) return "";
  return `═══ 主要指標の変動（蓄積データ） ═══\n${lines.join("\n")}`;
}

// Deep Analysis向け: テーマに関連する指標のみ抽出
export function formatThemeContext(
  memory: IntelligenceMemory,
  themeId: ThemeId,
): string {
  const parts: string[] = [];

  // テーマナラティブ
  const narrative = memory.theme_narratives[themeId];
  if (narrative) {
    parts.push(`═══ このテーマの蓄積文脈 ═══`);
    parts.push(`現状: ${narrative.current_summary}`);
    parts.push(`トレンド: ${narrative.dominant_trend}`);
    if (narrative.key_developments.length > 0) {
      parts.push(`直近の動き:\n${narrative.key_developments.map((d) => `- ${d}`).join("\n")}`);
    }
  }

  // 関連する指標
  const indicatorCtx = formatIndicatorContext(memory.key_indicators);
  if (indicatorCtx) parts.push(indicatorCtx);

  return parts.join("\n\n");
}

// 週次ディープダイブ向け: 前週サマリー
export function formatWeeklyContext(summaries: WeeklyMemorySummary[]): string {
  if (summaries.length === 0) return "";
  const lines = summaries.map((s) =>
    `[${s.week_end}] ${s.one_liner}（${s.key_numbers.join("、")}）`,
  );
  return `═══ 過去の週次レポート要約（連続性参照用） ═══\n${lines.join("\n")}`;
}

// テーマナラティブ更新用プロンプトのデータ整形
export function buildNarrativeUpdateInput(
  memory: IntelligenceMemory | null,
  todayArticles: AnalyzedArticle[],
  anomalies: OsintAnomaly[],
  changedIndicators: KeyIndicatorTracker[],
): string {
  const parts: string[] = [];

  // 前回の文脈
  if (memory?.theme_narratives) {
    const narrativeLines = Object.values(memory.theme_narratives)
      .filter((n): n is ThemeNarrative => !!n)
      .map((n) => `[${n.theme}] ${n.current_summary}`);
    if (narrativeLines.length > 0) {
      parts.push(`【前回の文脈メモリ】\n${narrativeLines.join("\n")}`);
    }
  }

  // 今日の記事
  if (todayArticles.length > 0) {
    const articleLines = todayArticles.map((a) =>
      `[${a.primary_theme}] ${a.title_ja}`,
    );
    parts.push(`【今日の記事（${todayArticles.length}件）】\n${articleLines.join("\n")}`);
  }

  // 異常値
  if (anomalies.length > 0) {
    const anomalyLines = anomalies.map((a) => `[${a.theme}] ${a.detail}（${a.severity}）`);
    parts.push(`【今日の異常値】\n${anomalyLines.join("\n")}`);
  }

  // 指標変動
  const changed = changedIndicators.filter((k) => k.change != null && k.change !== 0);
  if (changed.length > 0) {
    const indLines = changed.map((k) => {
      const dir = k.change! > 0 ? "+" : "";
      return `${k.label}: ${k.current_value}（${dir}${k.change!.toFixed(2)}）`;
    });
    parts.push(`【主要指標の変動】\n${indLines.join("\n")}`);
  }

  return parts.join("\n\n");
}

// 初期メモリ作成
export function createEmptyMemory(today: string): IntelligenceMemory {
  return {
    date: today,
    version: 0,
    key_indicators: [],
    theme_narratives: {},
    weekly_summaries: [],
  };
}
