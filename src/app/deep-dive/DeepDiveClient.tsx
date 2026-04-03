"use client";

import type { WeeklyDeepDive } from "@/lib/types";
import { THEME_MAP } from "@/lib/themes";

interface Props {
  deepDive: WeeklyDeepDive | null;
}

export default function DeepDiveClient({ deepDive }: Props) {
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
