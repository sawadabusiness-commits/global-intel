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
  const sourceLabels: Record<string, string> = {
    fred: "FRED", estat: "e-Stat", fao: "FAO", dbnomics: "World Bank",
    usgs: "USGS", opensanctions: "OpenSanctions", edinet: "EDINET",
    comtrade: "UN Comtrade", gfw: "GFW",
  };
  const countryLabels: Record<string, string> = {
    USA: "米", JPN: "日", CHN: "中", DEU: "独", IND: "印", BRA: "伯",
    US: "米", JP: "日", CN: "中", DE: "独", IN: "印", BR: "伯",
  };

  // indicatorでグループ化
  const byIndicator = new Map<string, OsintDataPoint[]>();
  for (const dp of data) {
    if (dp.value === null) continue;
    const list = byIndicator.get(dp.indicator) ?? [];
    list.push(dp);
    byIndicator.set(dp.indicator, list);
  }

  type ChartData = {
    label: string; source: string; unit: string;
    points: { label: string; value: number }[];
    isBar: boolean;
    // マルチライン用
    multiLines?: { country: string; color: string; points: { label: string; value: number }[] }[];
  };
  const charts: ChartData[] = [];
  const countryColors: Record<string, string> = {
    USA: "#3B82F6", JPN: "#EF4444", CHN: "#EAB308", DEU: "#22C55E", IND: "#A855F7", BRA: "#F97316",
    US: "#3B82F6", JP: "#EF4444", CN: "#EAB308", DE: "#22C55E", IN: "#A855F7", BR: "#F97316",
  };
  const processedIndicators = new Set<string>();

  // 1) FRED指標（時系列折れ線）
  const fredIndicators = ["FEDFUNDS", "DGS10", "T10YIE", "UNRATE", "DTWEXBGS"];
  for (const ind of fredIndicators) {
    const points = byIndicator.get(ind);
    if (!points || points.length === 0) continue;
    processedIndicators.add(ind);
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    charts.push({
      label: sorted[0].label, source: sorted[0].source, unit: sorted[0].unit ?? "",
      points: sorted.map((p) => ({ label: p.date.length >= 7 ? p.date.slice(2, 7).replace("-", "/") : p.date, value: p.value! })),
      isBar: false,
    });
  }

  // 2) FAO・CPI・GFW等（時系列折れ線）
  const otherTimeSeries = ["fao_food_price", "fao_cereals", "fao_oils", "fao_meat", "fao_dairy", "fao_sugar", "cpi_total", "gfw_encounter", "gfw_loitering", "gfw_port_visit", "earthquake_m45_total"];
  for (const ind of otherTimeSeries) {
    const points = byIndicator.get(ind);
    if (!points || points.length === 0) continue;
    processedIndicators.add(ind);
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    charts.push({
      label: sorted[0].label.replace(/（.*）/, ""), source: sorted[0].source, unit: sorted[0].unit ?? "",
      points: sorted.map((p) => ({ label: p.date.length >= 7 ? p.date.slice(2, 7).replace("-", "/") : p.date, value: p.value! })),
      isBar: false,
    });
  }

  // 3) World Bank指標（国別色分け折れ線）
  const wbIndicators = ["NY.GDP.MKTP.KD.ZG", "FP.CPI.TOTL.ZG", "NE.TRD.GNFS.ZS", "BX.KLT.DINV.WD.GD.ZS", "MS.MIL.XPND.GD.ZS", "MS.MIL.XPND.CD"];
  const wbLabels: Record<string, string> = {
    "NY.GDP.MKTP.KD.ZG": "GDP成長率", "FP.CPI.TOTL.ZG": "CPI上昇率",
    "NE.TRD.GNFS.ZS": "貿易/GDP比", "BX.KLT.DINV.WD.GD.ZS": "FDI流入/GDP比",
    "MS.MIL.XPND.GD.ZS": "軍事費/GDP比", "MS.MIL.XPND.CD": "軍事費(USD)",
  };
  for (const wbInd of wbIndicators) {
    const points = byIndicator.get(wbInd);
    if (!points || points.length === 0) continue;
    processedIndicators.add(wbInd);
    // 国ごとに時系列データを構築
    const byCountry = new Map<string, OsintDataPoint[]>();
    for (const p of points) {
      const cc = p.country ?? "";
      const list = byCountry.get(cc) ?? [];
      list.push(p);
      byCountry.set(cc, list);
    }
    // 全年を集めてソート（X軸の共通ラベル）
    const allYears = [...new Set(points.map((p) => p.date))].sort();
    const multiLines = Array.from(byCountry.entries()).map(([cc, pts]) => {
      const dateMap = new Map(pts.map((p) => [p.date, p.value!]));
      return {
        country: countryLabels[cc] ?? cc,
        color: countryColors[cc] ?? "#999",
        points: allYears.map((yr) => ({ label: yr, value: dateMap.get(yr) ?? NaN })),
      };
    });
    // ダミーのpoints（X軸ラベル用）
    const dummyPoints = allYears.map((yr) => ({ label: yr, value: 0 }));
    charts.push({
      label: wbLabels[wbInd] ?? wbInd, source: points[0].source, unit: points[0].unit ?? "",
      points: dummyPoints, isBar: false, multiLines,
    });
  }

  // 4) その他未処理（3点以上で時系列）
  for (const [ind, points] of byIndicator) {
    if (processedIndicators.has(ind) || points.length < 3) continue;
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    charts.push({
      label: sorted[0].label.replace(/（.*）/, ""), source: sorted[0].source, unit: sorted[0].unit ?? "",
      points: sorted.map((p) => ({ label: p.date.length >= 7 ? p.date.slice(2, 7).replace("-", "/") : p.date, value: p.value! })),
      isBar: false,
    });
  }

  if (charts.length === 0) return null;
  const latestDate = data.reduce((max, dp) => dp.date > max ? dp.date : max, data[0]?.date ?? "");

  return (
    <Section title={`OSINT Data Dashboard（${latestDate} 時点）`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((ch, i) => (
          <div key={i} className="p-4 rounded-lg" style={{ background: "var(--surface-2)" }}>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-medium text-[#E2E8F0]">{ch.label}</p>
              <p className="text-[9px] text-[var(--muted)]">{sourceLabels[ch.source] ?? ch.source}</p>
            </div>
            <MiniChart points={ch.points} unit={ch.unit} color={themeColor} isBar={ch.isBar} multiLines={ch.multiLines} />
          </div>
        ))}
      </div>
    </Section>
  );
}

// --- SVGチャート（折れ線 or 棒 or マルチライン） ---
function MiniChart({ points, unit, color, isBar = false, multiLines }: {
  points: { label: string; value: number }[]; unit: string; color: string; isBar?: boolean;
  multiLines?: { country: string; color: string; points: { label: string; value: number }[] }[];
}) {
  // マルチラインの場合は専用レンダリング
  if (multiLines && multiLines.length > 0) {
    return <MultiLineChart lines={multiLines} labels={points.map((p) => p.label)} unit={unit} />;
  }

  const W = 280;
  const H = 90;
  const PAD = { top: 5, right: 10, bottom: 22, left: 45 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const values = points.map((p) => p.value);
  const minVal = isBar ? Math.min(0, ...values) : Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const getX = (i: number) => PAD.left + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);
  const getY = (v: number) => PAD.top + chartH - ((v - minVal) / range) * chartH;

  const latest = points[points.length - 1];
  const prev = points.length >= 2 ? points[points.length - 2] : null;
  const change = prev ? latest.value - prev.value : 0;
  const changeColor = change > 0 ? "#10B981" : change < 0 ? "#F87171" : "#64748B";

  const fmtVal = (v: number) => {
    if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(0)}B`;
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
    if (Math.abs(v) >= 10_000) return `${(v / 1_000).toFixed(0)}k`;
    return v < 10 ? v.toFixed(2) : v.toLocaleString();
  };

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-lg font-mono text-[#E2E8F0]">{fmtVal(latest.value)}</span>
        <span className="text-[10px] text-[var(--muted)]">{unit}</span>
        {prev && (
          <span className="text-[10px] font-mono" style={{ color: changeColor }}>
            {change > 0 ? "+" : ""}{fmtVal(change)}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: "110px" }}>
        {/* Y軸グリッド */}
        {[0, 0.5, 1].map((pct) => {
          const y = PAD.top + chartH * (1 - pct);
          const val = minVal + range * pct;
          return (
            <g key={pct}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="var(--muted)" fontSize="8" fontFamily="monospace">
                {fmtVal(val)}
              </text>
            </g>
          );
        })}

        {isBar ? (
          /* 棒グラフ */
          <>
            {points.map((p, i) => {
              const barW = Math.min(chartW / points.length * 0.7, 30);
              const cx = PAD.left + ((i + 0.5) / points.length) * chartW;
              const y0 = getY(Math.max(0, minVal));
              const yVal = getY(p.value);
              const barH = Math.abs(yVal - y0);
              return (
                <g key={i}>
                  <rect x={cx - barW / 2} y={Math.min(yVal, y0)} width={barW} height={barH || 1}
                    fill={color} opacity="0.7" rx="2" />
                  <text x={cx} y={Math.min(yVal, y0) - 3} textAnchor="middle" fill="#E2E8F0" fontSize="7" fontFamily="monospace">
                    {fmtVal(p.value)}
                  </text>
                </g>
              );
            })}
          </>
        ) : (
          /* 折れ線グラフ */
          <>
            {points.length > 1 && (
              <>
                <path d={points.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(p.value).toFixed(1)}`).join(" ") + ` L ${getX(points.length - 1).toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${PAD.left.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`} fill={color} opacity="0.1" />
                <path d={points.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(p.value).toFixed(1)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
              </>
            )}
            {points.map((p, i) => (
              <circle key={i} cx={getX(i)} cy={getY(p.value)} r="2.5" fill={i === points.length - 1 ? color : "var(--surface)"} stroke={color} strokeWidth="1.5" />
            ))}
          </>
        )}

        {/* X軸ラベル */}
        {points.map((p, i) => {
          const step = isBar ? 1 : points.length <= 6 ? 1 : points.length <= 12 ? 2 : 3;
          if (!isBar && i !== 0 && i !== points.length - 1 && i % step !== 0) return null;
          const cx = isBar ? PAD.left + ((i + 0.5) / points.length) * chartW : getX(i);
          return (
            <text key={i} x={cx} y={H - 3} textAnchor="middle" fill="var(--muted)" fontSize="8" fontFamily="monospace">
              {p.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// --- 国別色分け折れ線グラフ ---
function MultiLineChart({ lines, labels, unit }: {
  lines: { country: string; color: string; points: { label: string; value: number }[] }[];
  labels: string[]; unit: string;
}) {
  const W = 300;
  const H = 150;
  const PAD = { top: 8, right: 10, bottom: 22, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // 全ラインの全値からmin/max
  const allValues = lines.flatMap((l) => l.points.map((p) => p.value).filter((v) => !isNaN(v)));
  if (allValues.length === 0) return null;
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  const getX = (i: number) => PAD.left + (labels.length === 1 ? chartW / 2 : (i / (labels.length - 1)) * chartW);
  const getY = (v: number) => PAD.top + chartH - ((v - minVal) / range) * chartH;

  const fmtVal = (v: number) => {
    if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(0)}B`;
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
    if (Math.abs(v) >= 10_000) return `${(v / 1_000).toFixed(0)}k`;
    return v < 10 && v > -10 ? v.toFixed(1) : v.toLocaleString();
  };

  return (
    <div>
      {/* 凡例 */}
      <div className="flex flex-wrap gap-3 mb-3">
        {lines.map((l) => (
          <div key={l.country} className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-[3px] rounded" style={{ background: l.color }} />
            <span className="text-[11px] font-mono font-medium" style={{ color: l.color }}>{l.country}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: "180px" }}>
        {/* Y軸グリッド */}
        {[0, 0.5, 1].map((pct) => {
          const y = PAD.top + chartH * (1 - pct);
          const val = minVal + range * pct;
          return (
            <g key={pct}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="var(--muted)" fontSize="7" fontFamily="monospace">
                {fmtVal(val)}
              </text>
            </g>
          );
        })}
        {/* 各国の折れ線 */}
        {lines.map((line) => {
          const validPoints = line.points.map((p, i) => ({ i, value: p.value })).filter((p) => !isNaN(p.value));
          if (validPoints.length < 2) return null;
          const pathD = validPoints.map((p, idx) => `${idx === 0 ? "M" : "L"} ${getX(p.i).toFixed(1)} ${getY(p.value).toFixed(1)}`).join(" ");
          return (
            <g key={line.country}>
              <path d={pathD} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinejoin="round" />
              {validPoints.map((p) => (
                <circle key={p.i} cx={getX(p.i)} cy={getY(p.value)} r="3" fill={line.color} />
              ))}
            </g>
          );
        })}
        {/* X軸ラベル */}
        {labels.map((label, i) => {
          const step = labels.length <= 6 ? 1 : labels.length <= 12 ? 2 : 3;
          if (i !== 0 && i !== labels.length - 1 && i % step !== 0) return null;
          return (
            <text key={i} x={getX(i)} y={PAD.top + chartH + 14} textAnchor="middle" fill="var(--muted)" fontSize="8" fontFamily="monospace">
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
