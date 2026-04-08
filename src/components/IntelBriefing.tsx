"use client";

import type { OsintAnomaly, IntelligenceMemory, KeyIndicatorTracker } from "@/lib/types";

interface Props {
  anomalies: OsintAnomaly[];
  memory: IntelligenceMemory | null;
  date: string;
}

/** 30px高のSVGスパークライン */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 60, h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="inline-block ml-2 align-middle">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** トレンド矢印 */
function TrendBadge({ tracker }: { tracker: KeyIndicatorTracker }) {
  const { change_pct, trend } = tracker;
  if (change_pct === null || change_pct === undefined) return null;
  const isUp = trend === "rising";
  const isDown = trend === "falling";
  const arrow = isUp ? "▲" : isDown ? "▼" : "→";
  const color = isUp ? "#10B981" : isDown ? "#EF4444" : "#94A3B8";
  const pct = Math.abs(change_pct).toFixed(1);
  return (
    <span className="text-[10px] font-mono ml-1" style={{ color }}>
      {arrow}{pct}%
    </span>
  );
}

/** 主要指標の表示順・ラベルマッピング */
const INDICATOR_DISPLAY: { indicator: string; short: string; color: string }[] = [
  { indicator: "FEDFUNDS", short: "FF金利", color: "#38BDF8" },
  { indicator: "DGS10", short: "米10Y", color: "#38BDF8" },
  { indicator: "UNRATE", short: "米失業率", color: "#38BDF8" },
  { indicator: "CPIAUCSL", short: "米CPI", color: "#FBBF24" },
  { indicator: "PCEPILFE", short: "コアPCE", color: "#FBBF24" },
  { indicator: "PAYEMS", short: "米NFP", color: "#38BDF8" },
  { indicator: "MADR1M", short: "日政策金利", color: "#EF4444" },
  { indicator: "IRLTLT01JPM156N", short: "日10Y", color: "#EF4444" },
  { indicator: "ECBDFR", short: "ECB金利", color: "#10B981" },
  { indicator: "BPBP6JYNCB", short: "日経常収支", color: "#EF4444" },
];

export default function IntelBriefing({ anomalies, memory, date }: Props) {
  if (!memory && anomalies.length === 0) return null;

  const indicators = memory?.key_indicators ?? [];
  const narratives = memory?.theme_narratives ?? {};

  // 変化率Top5（絶対値が大きい順）
  const topChanges = [...indicators]
    .filter((t) => t.change_pct !== null && t.change_pct !== undefined && t.change_pct !== 0)
    .sort((a, b) => Math.abs(b.change_pct!) - Math.abs(a.change_pct!))
    .slice(0, 5);

  // 表示用指標（INDICATOR_DISPLAYの順に、存在するもののみ）
  const displayIndicators = INDICATOR_DISPLAY
    .map((d) => ({ ...d, tracker: indicators.find((t) => t.indicator === d.indicator) }))
    .filter((d) => d.tracker);

  // ナラティブから本日のブリーフィング3行を生成
  const briefingLines: string[] = [];
  const narrativeEntries = Object.values(narratives).filter((n) => n && n.current_summary);
  if (narrativeEntries.length > 0) {
    // dominant_trendで特徴的なものを最大3つ選出
    const sorted = [...narrativeEntries].sort((a, b) => (b!.key_developments.length) - (a!.key_developments.length));
    for (const n of sorted.slice(0, 3)) {
      if (n?.dominant_trend) briefingLines.push(n.dominant_trend);
    }
  }
  if (briefingLines.length === 0 && topChanges.length > 0) {
    briefingLines.push(`注目: ${topChanges.slice(0, 3).map((t) => `${t.label} ${t.trend === "rising" ? "上昇" : t.trend === "falling" ? "下落" : "横ばい"}(${t.change_pct!.toFixed(1)}%)`).join("、")}`);
  }

  return (
    <div className="mb-6 space-y-4">
      {/* 施策1: 本日のブリーフィング */}
      {briefingLines.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="text-[#38BDF8]">■</span> Daily Briefing
            <span className="text-[var(--muted)]">{date}</span>
          </h3>
          <div className="space-y-1">
            {briefingLines.map((line, i) => (
              <p key={i} className="text-xs text-[#E2E8F0] leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 施策2: 異常値アラート */}
      {anomalies.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "#7F1D1D20", border: "1px solid #EF444440" }}>
          <h3 className="text-[10px] font-mono uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: "#EF4444" }}>
            ⚠ Anomaly Alerts
            <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: "#EF444430" }}>
              {anomalies.length}
            </span>
          </h3>
          <div className="space-y-2">
            {anomalies.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] font-mono shrink-0 mt-0.5" style={{ color: a.severity === "high" ? "#EF4444" : "#FBBF24" }}>
                  {a.severity === "high" ? "HIGH" : "MED"}
                </span>
                <div className="flex-1">
                  <p className="text-xs text-[#E2E8F0]">{a.detail}</p>
                  <p className="text-[10px] font-mono text-[var(--muted)] mt-0.5">
                    {a.source} | {a.type} | 変化: {a.change_pct > 0 ? "+" : ""}{a.change_pct.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 施策3: 主要指標 + スパークライン + トレンド矢印 */}
      {displayIndicators.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider mb-3">
            Key Indicators
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {displayIndicators.map(({ short, color, tracker }) => {
              if (!tracker) return null;
              const histValues = tracker.history.map((h) => h.value);
              return (
                <div key={tracker.indicator} className="p-2 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <p className="text-[10px] font-mono text-[var(--muted)] truncate">{short}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-sm font-mono text-[#E2E8F0]">
                      {tracker.current_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <TrendBadge tracker={tracker} />
                  </div>
                  {histValues.length >= 2 && <Sparkline data={histValues} color={color} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 施策4: 前日比変化Top5 */}
      {topChanges.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider mb-2">
            Biggest Moves
          </h3>
          <div className="space-y-1.5">
            {topChanges.map((t) => {
              const isUp = (t.change_pct ?? 0) > 0;
              const color = isUp ? "#10B981" : "#EF4444";
              return (
                <div key={t.indicator} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-[10px] w-16 text-right shrink-0" style={{ color }}>
                    {isUp ? "+" : ""}{t.change_pct!.toFixed(1)}%
                  </span>
                  <div className="h-1.5 rounded-full flex-1 max-w-[100px]" style={{ background: "var(--surface-2)" }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${Math.min(Math.abs(t.change_pct!) * 5, 100)}%`, background: color }}
                    />
                  </div>
                  <span className="text-[#E2E8F0] truncate">{t.label}</span>
                  <span className="text-[10px] font-mono text-[var(--muted)] shrink-0">
                    {t.current_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
