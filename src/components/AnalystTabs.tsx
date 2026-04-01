"use client";

import { useState } from "react";
import { THEME_MAP, PROBABILITY_COLORS, TIMEFRAMES } from "@/lib/themes";
import type { GeminiAnalysis } from "@/lib/types";

interface Props {
  analysis: GeminiAnalysis;
}

type Tab = "structural" | "devils" | "historical";

export default function AnalystTabs({ analysis }: Props) {
  const [tab, setTab] = useState<Tab>("structural");

  const tabs: { id: Tab; label: string; labelJa: string }[] = [
    { id: "structural", label: "Structural", labelJa: "構造分析" },
    { id: "devils", label: "Devil's Advocate", labelJa: "反論" },
    { id: "historical", label: "Historical", labelJa: "歴史検証" },
  ];

  return (
    <div className="mt-4">
      <div className="flex gap-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
            style={{
              background: tab === t.id ? "var(--surface-2)" : "transparent",
              color: tab === t.id ? "#E2E8F0" : "var(--muted)",
              border: `1px solid ${tab === t.id ? "var(--border)" : "transparent"}`,
            }}
          >
            {t.labelJa}
          </button>
        ))}
      </div>

      {tab === "structural" && (
        <div className="space-y-4">
          {/* 構造的要因 */}
          <div>
            <h4 className="text-xs font-mono text-[var(--muted)] mb-2 uppercase tracking-wider">
              Structural Factors
            </h4>
            <div className="space-y-2">
              {analysis.analyst1.structural_factors.map((f, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <p className="text-sm font-medium text-[#E2E8F0]">{f.factor}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">{f.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 横断テーマ */}
          <div>
            <h4 className="text-xs font-mono text-[var(--muted)] mb-2 uppercase tracking-wider">
              Cross-Theme Connections
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.analyst1.cross_theme_connections.map((c, i) => {
                const theme = THEME_MAP[c.theme];
                return (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-lg text-xs"
                    style={{ background: (theme?.color ?? "#666") + "15", border: `1px solid ${theme?.color ?? "#666"}30` }}
                  >
                    <span style={{ color: theme?.color }}>{theme?.icon} {theme?.labelJa}</span>
                    <p className="text-[var(--muted)] mt-1">{c.connection}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* シナリオ */}
          <div>
            <h4 className="text-xs font-mono text-[var(--muted)] mb-2 uppercase tracking-wider">
              Scenarios
            </h4>
            <div className="space-y-2">
              {analysis.analyst1.scenarios.map((s, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[#E2E8F0]">{s.name}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono"
                      style={{ background: (PROBABILITY_COLORS[s.probability] ?? "#666") + "20", color: PROBABILITY_COLORS[s.probability] }}
                    >
                      {s.probability}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono"
                      style={{ background: (TIMEFRAMES[s.timeframe]?.color ?? "#666") + "20", color: TIMEFRAMES[s.timeframe]?.color }}
                    >
                      {TIMEFRAMES[s.timeframe]?.labelJa}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{s.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 先行シグナル */}
          <div>
            <h4 className="text-xs font-mono text-[var(--muted)] mb-2 uppercase tracking-wider">
              Signals to Watch
            </h4>
            <ul className="space-y-1">
              {analysis.analyst1.signals_to_watch.map((s, i) => (
                <li key={i} className="text-xs text-[var(--muted)] flex items-start gap-2">
                  <span className="text-[#38BDF8] mt-0.5">▸</span> {s}
                </li>
              ))}
            </ul>
          </div>

          {/* 日本への示唆 */}
          <div className="p-3 rounded-lg" style={{ background: "#FBBF2410", border: "1px solid #FBBF2430" }}>
            <h4 className="text-xs font-mono text-[#FBBF24] mb-1">Japan Implications</h4>
            <p className="text-xs text-[var(--muted)]">{analysis.analyst1.japan_implications}</p>
          </div>
        </div>
      )}

      {tab === "devils" && (
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-mono text-[var(--muted)] mb-2 uppercase tracking-wider">
              Counterarguments
            </h4>
            <div className="space-y-2">
              {analysis.analyst2.counterarguments.map((c, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: "#EF444410", border: "1px solid #EF444420" }}>
                  <p className="text-sm font-medium text-[#F87171]">{c.point}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">{c.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
            <h4 className="text-xs font-mono text-[#F87171] mb-1">Biggest Error Source</h4>
            <p className="text-xs text-[var(--muted)]">{analysis.analyst2.biggest_error_source}</p>
          </div>

          <div className="p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
            <h4 className="text-xs font-mono text-[#FBBF24] mb-1">Consensus Bias</h4>
            <p className="text-xs text-[var(--muted)]">{analysis.analyst2.consensus_bias}</p>
          </div>

          <div className="p-3 rounded-lg" style={{ background: "#C084FC10", border: "1px solid #C084FC20" }}>
            <h4 className="text-xs font-mono text-[#C084FC] mb-1">Blind Spot</h4>
            <p className="text-xs text-[var(--muted)]">{analysis.analyst2.blind_spot}</p>
          </div>
        </div>
      )}

      {tab === "historical" && (
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-mono text-[var(--muted)] mb-2 uppercase tracking-wider">
              Historical Cases
            </h4>
            <div className="space-y-2">
              {analysis.analyst3.historical_cases.map((c, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <p className="text-sm font-medium text-[#E2E8F0]">{c.event}</p>
                  <p className="text-xs text-[#38BDF8] mt-1">類似点: {c.parallel}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">結末: {c.outcome}</p>
                  <p className="text-xs text-[#FBBF24] mt-1 italic">教訓: {c.lesson}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg" style={{ background: "#EF444410", border: "1px solid #EF444420" }}>
            <h4 className="text-xs font-mono text-[#F87171] mb-1">Overlooked Risk</h4>
            <p className="text-xs text-[var(--muted)]">{analysis.analyst3.overlooked_risk}</p>
          </div>

          <div className="p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
            <h4 className="text-xs font-mono text-[#38BDF8] mb-1">Probability Correction</h4>
            <p className="text-xs text-[var(--muted)]">{analysis.analyst3.probability_correction}</p>
          </div>
        </div>
      )}
    </div>
  );
}
