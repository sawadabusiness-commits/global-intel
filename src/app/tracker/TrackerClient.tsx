"use client";

import { useState } from "react";
import { THEME_MAP, PREDICTION_STATUS, PROBABILITY_COLORS } from "@/lib/themes";
import type { Prediction, PredictionStatus } from "@/lib/types";

interface Props {
  predictions: Prediction[];
}

export default function TrackerClient({ predictions }: Props) {
  const [filterStatus, setFilterStatus] = useState<PredictionStatus | "all">("all");

  const filtered = filterStatus === "all"
    ? predictions
    : predictions.filter((p) => p.status === filterStatus);

  const stats = {
    total: predictions.length,
    correct: predictions.filter((p) => p.status === "correct").length,
    partial: predictions.filter((p) => p.status === "partially_correct").length,
    incorrect: predictions.filter((p) => p.status === "incorrect").length,
    ongoing: predictions.filter((p) => p.status === "ongoing").length,
  };

  const accuracy = stats.total > 0
    ? Math.round(((stats.correct + stats.partial * 0.5) / (stats.total - stats.ongoing)) * 100) || 0
    : 0;

  return (
    <div className="flex min-h-screen">
      {/* サイドバー */}
      <aside
        className="hidden lg:flex w-64 flex-col p-5 border-r shrink-0"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="text-lg mb-1" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Global Intel
        </h2>
        <p className="text-[10px] font-mono text-[var(--muted)] mb-6">Prediction Tracker</p>

        <nav className="space-y-1 mb-6">
          <a href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]">
            Dashboard
          </a>
          <a href="/tracker" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-[var(--surface-2)] text-[#E2E8F0]">
            Prediction Tracker
          </a>
        </nav>

        {/* スコアサマリ */}
        <div className="p-4 rounded-xl mb-4" style={{ background: "var(--surface-2)" }}>
          <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider mb-2">
            Accuracy
          </p>
          <p className="text-3xl font-mono text-[#E2E8F0]">{accuracy}%</p>
          <div className="mt-3 space-y-1">
            {(Object.entries(PREDICTION_STATUS) as [PredictionStatus, typeof PREDICTION_STATUS[keyof typeof PREDICTION_STATUS]][]).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span style={{ color: val.color }}>{val.icon}</span>
                <span className="text-[var(--muted)]">{val.label}</span>
                <span className="ml-auto font-mono" style={{ color: val.color }}>
                  {stats[key === "partially_correct" ? "partial" : key as keyof typeof stats]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 p-6">
        <div className="lg:hidden mb-6">
          <h1 className="text-2xl" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Prediction Tracker
          </h1>
          <a href="/" className="text-xs text-[var(--muted)] hover:text-[#38BDF8]">← Dashboard</a>
        </div>

        {/* フィルタ */}
        <div className="flex gap-2 mb-6">
          {(["all", "ongoing", "correct", "partially_correct", "incorrect"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: filterStatus === s ? "var(--surface-2)" : "transparent",
                color: filterStatus === s ? "#E2E8F0" : "var(--muted)",
                border: `1px solid ${filterStatus === s ? "var(--border)" : "transparent"}`,
              }}
            >
              {s === "all" ? "すべて" : PREDICTION_STATUS[s].label}
            </button>
          ))}
        </div>

        {/* 判断記録一覧 */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[var(--muted)] text-sm">判断記録がありません</p>
            <p className="text-[var(--muted)] text-xs mt-1">
              ダッシュボードで記事を開き、シナリオを選択して記録できます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => {
              const theme = THEME_MAP[p.theme];
              const status = PREDICTION_STATUS[p.status];
              return (
                <div
                  key={p.id}
                  className="p-4 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 text-lg"
                      style={{ color: status.color }}
                    >
                      {status.icon}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#E2E8F0]">{p.article_title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-mono"
                          style={{ background: (theme?.color ?? "#666") + "20", color: theme?.color }}
                        >
                          {theme?.labelJa}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--muted)]">{p.date}</span>
                      </div>
                      <div className="mt-2 p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                        <p className="text-xs text-[#E2E8F0]">
                          選択: <span className="font-medium">{p.my_scenario}</span>
                        </p>
                        <p className="text-xs text-[var(--muted)] mt-1">
                          確信度:{" "}
                          <span style={{ color: PROBABILITY_COLORS[p.my_confidence] }}>
                            {p.my_confidence}
                          </span>
                        </p>
                        {p.my_reasoning && (
                          <p className="text-xs text-[var(--muted)] mt-1 italic">{p.my_reasoning}</p>
                        )}
                      </div>
                      {p.actual_outcome && (
                        <div className="mt-2 p-3 rounded-lg" style={{ background: "#10B98110" }}>
                          <p className="text-xs text-[#10B981]">実際の展開: {p.actual_outcome}</p>
                          {p.score !== null && (
                            <p className="text-xs font-mono mt-1" style={{ color: status.color }}>
                              Score: {p.score}/100
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
