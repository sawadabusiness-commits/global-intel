"use client";

import type { WeeklyDeepDive, OsintDataPoint } from "@/lib/types";
import { THEME_MAP } from "@/lib/themes";

interface Props {
  deepDive: WeeklyDeepDive | null;
  osintData?: OsintDataPoint[];
}

export default function DeepDiveClient({ deepDive, osintData = [] }: Props) {
  if (!deepDive) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <p className="text-[var(--muted)] text-sm">
            週次ディープダイブはまだ生成されていません
          </p>
        </main>
      </div>
    );
  }

  const theme = THEME_MAP[deepDive.theme];
  const { report } = deepDive;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl" style={{ color: theme?.color }}>
              {theme?.icon}
            </span>
            <h1
              className="text-2xl"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              {report.title}
            </h1>
          </div>
          <p className="text-xs font-mono text-[var(--muted)]">
            {deepDive.week_start} ~ {deepDive.week_end} | {deepDive.theme_label_ja} | {deepDive.article_count}件の記事を分析
          </p>
        </div>

        {/* エグゼクティブサマリー */}
        <Section title="Executive Summary">
          <p className="text-sm leading-relaxed">{report.executive_summary}</p>
        </Section>

        {/* OSINTデータダッシュボード */}
        {osintData.length > 0 && <OsintDashboard data={osintData} themeColor={theme?.color ?? "#60A5FA"} />}

        {/* 主要な展開 */}
        <Section title="Key Developments">
          <div className="space-y-4">
            {report.key_developments.map((d, i) => (
              <div key={i} className="border-l-2 pl-4" style={{ borderColor: theme?.color ?? "var(--border)" }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-mono text-[var(--muted)]">{d.date}</span>
                  <h4 className="text-sm font-medium">{d.headline}</h4>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">{d.detail}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* トレンド分析 */}
        <Section title="Trend Analysis">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.trend_analysis}</p>
        </Section>

        {/* テーマ横断インパクト */}
        <Section title="Cross-Theme Impact">
          <div className="grid gap-3">
            {report.cross_theme_impact.map((c, i) => {
              const t = THEME_MAP[c.theme];
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <span style={{ color: t?.color }}>{t?.icon ?? "?"}</span>
                  <div>
                    <span className="text-xs font-medium" style={{ color: t?.color }}>
                      {t?.labelJa ?? c.theme}
                    </span>
                    <p className="text-xs text-[var(--muted)] mt-1">{c.impact}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* シナリオ */}
        <Section title="Scenarios">
          <div className="space-y-3">
            {report.scenarios.map((s, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{
                    background: "var(--surface)",
                    color: s.probability === "高" ? "#DC2626" : s.probability === "中〜高" ? "#F59E0B" : "#6366F1",
                  }}>
                    {s.probability}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 日本への示唆 */}
        <Section title="Japan Implications">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.japan_implications}</p>
        </Section>

        {/* 今週の注目ITサービス */}
        {report.notable_services && report.notable_services.length > 0 && (
          <Section title="Notable IT Services This Week">
            <div className="space-y-3">
              {report.notable_services.map((s, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:text-[#38BDF8] transition-colors"
                    >
                      {s.name} →
                    </a>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "#F59E0B20", color: "#F59E0B" }}>
                      ▲ {s.score}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 来週の注目点 */}
        <Section title="Watch Next Week">
          <ul className="space-y-2">
            {report.watch_next_week.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[var(--muted)]">▸</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}

function Sidebar() {
  return (
    <aside
      className="hidden lg:flex w-64 flex-col p-5 border-r shrink-0"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <h2 className="text-lg mb-1" style={{ fontFamily: "'Instrument Serif', serif" }}>
        Global Intel
      </h2>
      <p className="text-[10px] font-mono text-[var(--muted)] mb-6">Weekly Deep Dive</p>

      <nav className="space-y-1">
        <a href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]">
          Dashboard
        </a>
        <a href="/tracker" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]">
          Prediction Tracker
        </a>
        <a href="/deep-dive" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-[var(--surface-2)] text-[#E2E8F0]">
          Weekly Deep Dive
        </a>
      </nav>
    </aside>
  );
}

// --- OSINTデータダッシュボード ---
function OsintDashboard({ data, themeColor }: { data: OsintDataPoint[]; themeColor: string }) {
  // 時系列データをグループ化（同じindicatorで複数日付があるもの）
  const byIndicator = new Map<string, OsintDataPoint[]>();
  for (const dp of data) {
    const list = byIndicator.get(dp.indicator) ?? [];
    list.push(dp);
    byIndicator.set(dp.indicator, list);
  }

  // 時系列チャート用（3点以上あるデータ）
  const timeSeriesGroups: { label: string; points: { date: string; value: number }[]; unit: string; source: string }[] = [];
  for (const [, points] of byIndicator) {
    if (points.length >= 3 && points[0].value !== null) {
      const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
      timeSeriesGroups.push({
        label: sorted[0].label.replace(/（.*）/, ""),
        points: sorted.map((p) => ({ date: p.date, value: p.value! })),
        unit: sorted[0].unit ?? "",
        source: sorted[0].source,
      });
    }
  }

  // 主要指標カード用（最新値のみ）
  const keyIndicators: { label: string; value: number; unit: string; source: string }[] = [];
  const targetIndicators = ["FEDFUNDS", "DGS10", "T10YIE", "UNRATE", "fao_food_price", "earthquake_m45_total", "gfw_loitering", "gfw_encounter"];
  for (const ind of targetIndicators) {
    const points = byIndicator.get(ind);
    if (points && points.length > 0) {
      const latest = [...points].sort((a, b) => b.date.localeCompare(a.date))[0];
      if (latest.value !== null) {
        keyIndicators.push({
          label: latest.label.replace(/（.*）/, ""),
          value: latest.value,
          unit: latest.unit ?? "",
          source: latest.source,
        });
      }
    }
  }

  if (timeSeriesGroups.length === 0 && keyIndicators.length === 0) return null;

  const sourceLabels: Record<string, string> = {
    fred: "FRED", estat: "e-Stat", fao: "FAO", dbnomics: "World Bank",
    usgs: "USGS", opensanctions: "OpenSanctions", edinet: "EDINET",
    comtrade: "UN Comtrade", gfw: "GFW",
  };

  // 最新データの日付を取得
  const latestDate = data.reduce((max, dp) => dp.date > max ? dp.date : max, data[0]?.date ?? "");

  return (
    <Section title={`OSINT Data Dashboard（${latestDate} 時点）`}>
      {/* 主要指標カード */}
      {keyIndicators.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {keyIndicators.map((ki, i) => (
            <div key={i} className="p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
              <p className="text-[10px] font-mono text-[var(--muted)] uppercase">{ki.label}</p>
              <p className="text-xl font-mono text-[#E2E8F0] mt-1">
                {ki.value.toLocaleString()}<span className="text-xs text-[var(--muted)] ml-1">{ki.unit}</span>
              </p>
              <p className="text-[9px] text-[var(--muted)] mt-1">{sourceLabels[ki.source] ?? ki.source}</p>
            </div>
          ))}
        </div>
      )}

      {/* 時系列チャート */}
      {timeSeriesGroups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {timeSeriesGroups.slice(0, 6).map((ts, i) => (
            <div key={i} className="p-4 rounded-lg" style={{ background: "var(--surface-2)" }}>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-xs font-medium text-[#E2E8F0]">{ts.label}</p>
                <p className="text-[9px] text-[var(--muted)]">{sourceLabels[ts.source] ?? ts.source}</p>
              </div>
              <MiniLineChart points={ts.points} unit={ts.unit} color={themeColor} />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// --- SVGミニ折れ線グラフ ---
function MiniLineChart({ points, unit, color }: { points: { date: string; value: number }[]; unit: string; color: string }) {
  const W = 280;
  const H = 80;
  const PAD = { top: 5, right: 10, bottom: 20, left: 45 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const getX = (i: number) => PAD.left + (i / (points.length - 1)) * chartW;
  const getY = (v: number) => PAD.top + chartH - ((v - minVal) / range) * chartH;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(p.value).toFixed(1)}`)
    .join(" ");

  // 塗りつぶし用パス
  const areaD = `${pathD} L ${getX(points.length - 1).toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${PAD.left.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`;

  const latest = points[points.length - 1];
  const prev = points[points.length - 2];
  const change = prev ? latest.value - prev.value : 0;
  const changeColor = change > 0 ? "#10B981" : change < 0 ? "#F87171" : "#64748B";

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-lg font-mono text-[#E2E8F0]">{latest.value.toLocaleString()}</span>
        <span className="text-[10px] text-[var(--muted)]">{unit}</span>
        {prev && (
          <span className="text-[10px] font-mono" style={{ color: changeColor }}>
            {change > 0 ? "+" : ""}{change.toFixed(1)}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: "100px" }}>
        {/* 背景グリッド */}
        {[0, 0.5, 1].map((pct) => {
          const y = PAD.top + chartH * (1 - pct);
          const val = minVal + range * pct;
          return (
            <g key={pct}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="var(--muted)" fontSize="8" fontFamily="monospace">
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(val < 10 ? 2 : 0)}
              </text>
            </g>
          );
        })}
        {/* 塗りつぶし */}
        <path d={areaD} fill={color} opacity="0.1" />
        {/* 線 */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {/* ドット */}
        {points.map((p, i) => (
          <circle key={i} cx={getX(i)} cy={getY(p.value)} r="2.5" fill={i === points.length - 1 ? color : "var(--surface)"} stroke={color} strokeWidth="1.5" />
        ))}
        {/* X軸ラベル — 間引いて表示 */}
        {points.map((p, i) => {
          // 表示間隔: データ数に応じて間引く（最初・最後は必ず表示）
          const step = points.length <= 6 ? 1 : points.length <= 12 ? 2 : 3;
          if (i !== 0 && i !== points.length - 1 && i % step !== 0) return null;
          // 年月形式で表示（"2026-01" → "26/01", "2025" → "2025"）
          const label = p.date.length >= 7 ? p.date.slice(2, 7).replace("-", "/") : p.date;
          return (
            <text key={i} x={getX(i)} y={H - 2} textAnchor="middle" fill="var(--muted)" fontSize="8" fontFamily="monospace">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3
        className="text-lg mb-3 pb-2 border-b"
        style={{ fontFamily: "'Instrument Serif', serif", borderColor: "var(--border)" }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}
