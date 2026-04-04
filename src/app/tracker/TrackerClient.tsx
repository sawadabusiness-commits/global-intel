"use client";

import { useState } from "react";
import { THEME_MAP, PREDICTION_STATUS, PROBABILITY_COLORS } from "@/lib/themes";
import type { Prediction, PredictionStatus, ThemeId, Probability } from "@/lib/types";

type TabView = "list" | "bias";

interface Props {
  predictions: Prediction[];
}

// --- バイアス分析ユーティリティ ---
function calcScore(p: Prediction): number {
  if (p.status === "correct") return 1;
  if (p.status === "partially_correct") return 0.5;
  if (p.status === "incorrect") return 0;
  return -1; // ongoing
}

const CONFIDENCE_ORDER: Probability[] = ["低", "低〜中", "中", "中〜高", "高"];
const CONFIDENCE_EXPECTED: Record<Probability, number> = {
  "低": 0.2, "低〜中": 0.35, "中": 0.5, "中〜高": 0.7, "高": 0.85,
};

function analyzeByTheme(predictions: Prediction[]) {
  const resolved = predictions.filter((p) => p.status !== "ongoing");
  const byTheme = new Map<ThemeId, { correct: number; total: number }>();
  for (const p of resolved) {
    const entry = byTheme.get(p.theme) ?? { correct: 0, total: 0 };
    entry.total++;
    entry.correct += calcScore(p);
    byTheme.set(p.theme, entry);
  }
  return Array.from(byTheme.entries())
    .map(([theme, { correct, total }]) => ({
      theme,
      label: THEME_MAP[theme]?.labelJa ?? theme,
      color: THEME_MAP[theme]?.color ?? "#666",
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      total,
    }))
    .sort((a, b) => b.total - a.total);
}

function analyzeByConfidence(predictions: Prediction[]) {
  const resolved = predictions.filter((p) => p.status !== "ongoing");
  const byConf = new Map<Probability, { correct: number; total: number }>();
  for (const p of resolved) {
    const entry = byConf.get(p.my_confidence) ?? { correct: 0, total: 0 };
    entry.total++;
    entry.correct += calcScore(p);
    byConf.set(p.my_confidence, entry);
  }
  return CONFIDENCE_ORDER
    .filter((c) => byConf.has(c))
    .map((conf) => {
      const { correct, total } = byConf.get(conf)!;
      const actual = total > 0 ? Math.round((correct / total) * 100) : 0;
      const expected = Math.round(CONFIDENCE_EXPECTED[conf] * 100);
      return { confidence: conf, actual, expected, total, gap: actual - expected };
    });
}

function analyzeByMonth(predictions: Prediction[]) {
  const resolved = predictions.filter((p) => p.status !== "ongoing");
  const byMonth = new Map<string, { correct: number; total: number }>();
  for (const p of resolved) {
    const month = p.date.slice(0, 7); // "2026-04"
    const entry = byMonth.get(month) ?? { correct: 0, total: 0 };
    entry.total++;
    entry.correct += calcScore(p);
    byMonth.set(month, entry);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { correct, total }]) => ({
      month,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      total,
    }));
}

export default function TrackerClient({ predictions }: Props) {
  const [filterStatus, setFilterStatus] = useState<PredictionStatus | "all">("all");
  const [tab, setTab] = useState<TabView>("list");

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
          <a href="/deep-dive" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]">
            Weekly Deep Dive
          </a>
        </nav>

        {/* タブ切り替え */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "var(--surface-2)" }}>
          <button
            onClick={() => setTab("list")}
            className="flex-1 px-2 py-1.5 rounded text-xs transition-all"
            style={{
              background: tab === "list" ? "var(--surface)" : "transparent",
              color: tab === "list" ? "#E2E8F0" : "var(--muted)",
            }}
          >
            記録一覧
          </button>
          <button
            onClick={() => setTab("bias")}
            className="flex-1 px-2 py-1.5 rounded text-xs transition-all"
            style={{
              background: tab === "bias" ? "var(--surface)" : "transparent",
              color: tab === "bias" ? "#E2E8F0" : "var(--muted)",
            }}
          >
            バイアス分析
          </button>
        </div>

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
          <div className="flex gap-2 mt-3">
            <button onClick={() => setTab("list")} className={`px-3 py-1 rounded-full text-xs ${tab === "list" ? "bg-[var(--surface-2)] text-[#E2E8F0]" : "text-[var(--muted)]"}`}>記録一覧</button>
            <button onClick={() => setTab("bias")} className={`px-3 py-1 rounded-full text-xs ${tab === "bias" ? "bg-[var(--surface-2)] text-[#E2E8F0]" : "text-[var(--muted)]"}`}>バイアス分析</button>
          </div>
        </div>

        {tab === "bias" ? (
          <BiasAnalysisView predictions={predictions} />
        ) : (
        <>
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
        </>
        )}
      </main>
    </div>
  );
}

// --- バイアス分析ビュー ---
function BiasAnalysisView({ predictions }: { predictions: Prediction[] }) {
  const resolved = predictions.filter((p) => p.status !== "ongoing");
  const themeData = analyzeByTheme(predictions);
  const confData = analyzeByConfidence(predictions);
  const monthData = analyzeByMonth(predictions);

  if (resolved.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--muted)] text-sm">検証済みの判断記録がありません</p>
        <p className="text-[var(--muted)] text-xs mt-1">判断が検証されるとバイアス分析が表示されます</p>
      </div>
    );
  }

  // 過信/過小評価の判定
  const overconfident = confData.filter((c) => c.gap < -15);
  const underconfident = confData.filter((c) => c.gap > 15);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-[#E2E8F0]" style={{ fontFamily: "'Instrument Serif', serif" }}>
        思考の癖を可視化
      </h2>

      {/* サマリカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">検証済み</p>
          <p className="text-2xl font-mono text-[#E2E8F0] mt-1">{resolved.length}件</p>
        </div>
        <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">得意テーマ</p>
          <p className="text-2xl font-mono mt-1" style={{ color: themeData[0]?.color ?? "#666" }}>
            {themeData.length > 0 ? themeData.sort((a, b) => b.accuracy - a.accuracy)[0]?.label : "—"}
          </p>
        </div>
        <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">傾向</p>
          <p className="text-sm font-mono mt-2" style={{ color: overconfident.length > 0 ? "#F87171" : underconfident.length > 0 ? "#38BDF8" : "#10B981" }}>
            {overconfident.length > 0 ? "過信傾向あり" : underconfident.length > 0 ? "慎重すぎる傾向" : "バランス良好"}
          </p>
        </div>
      </div>

      {/* テーマ別正答率 */}
      <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-4">テーマ別の正答率</p>
        <div className="space-y-3">
          {themeData.map((t) => (
            <div key={t.theme} className="flex items-center gap-3">
              <span className="text-xs w-24 truncate" style={{ color: t.color }}>{t.label}</span>
              <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${t.accuracy}%`, background: t.color, opacity: 0.7 }}
                />
              </div>
              <span className="text-xs font-mono text-[#E2E8F0] w-12 text-right">{t.accuracy}%</span>
              <span className="text-[10px] font-mono text-[var(--muted)] w-8">n={t.total}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 確信度 vs 的中率 */}
      <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-1">確信度 vs 実際の的中率</p>
        <p className="text-[10px] text-[var(--muted)] mb-4">ギャップが大きいほど自己評価にバイアスあり</p>
        <div className="space-y-3">
          {confData.map((c) => (
            <div key={c.confidence} className="flex items-center gap-3">
              <span className="text-xs w-12" style={{ color: PROBABILITY_COLORS[c.confidence] }}>{c.confidence}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
                  <span className="text-[var(--muted)]">期待</span>
                  <span className="text-[#64748B]">{c.expected}%</span>
                  <span className="text-[var(--muted)]">→ 実際</span>
                  <span className="text-[#E2E8F0]">{c.actual}%</span>
                  <span style={{ color: c.gap > 0 ? "#10B981" : c.gap < -10 ? "#F87171" : "#F59E0B" }}>
                    ({c.gap > 0 ? "+" : ""}{c.gap}%)
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden relative" style={{ background: "var(--surface-2)" }}>
                  <div className="absolute h-full rounded-full" style={{ width: `${c.expected}%`, background: "#64748B", opacity: 0.4 }} />
                  <div className="absolute h-full rounded-full" style={{ width: `${c.actual}%`, background: c.gap >= 0 ? "#10B981" : "#F87171", opacity: 0.7 }} />
                </div>
              </div>
              <span className="text-[10px] font-mono text-[var(--muted)] w-8">n={c.total}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 月別推移 */}
      {monthData.length > 1 && (
        <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-4">月別の判断精度推移</p>
          <div className="flex items-end gap-2 h-32">
            {monthData.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-mono text-[#E2E8F0]">{m.accuracy}%</span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${m.accuracy}%`,
                    background: m.accuracy >= 70 ? "#10B981" : m.accuracy >= 40 ? "#F59E0B" : "#F87171",
                    opacity: 0.7,
                    minHeight: "4px",
                  }}
                />
                <span className="text-[10px] font-mono text-[var(--muted)]">{m.month.slice(5)}</span>
                <span className="text-[10px] font-mono text-[var(--muted)]">n={m.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 改善アドバイス */}
      <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-3">検出されたバイアス</p>
        <div className="space-y-2">
          {overconfident.map((c) => (
            <p key={c.confidence} className="text-xs text-[#F87171]">
              確信度「{c.confidence}」で過信傾向: 期待{c.expected}%に対し実際{c.actual}%（{c.gap}%の乖離）
            </p>
          ))}
          {underconfident.map((c) => (
            <p key={c.confidence} className="text-xs text-[#38BDF8]">
              確信度「{c.confidence}」で過小評価: 期待{c.expected}%に対し実際{c.actual}%（+{c.gap}%の乖離）
            </p>
          ))}
          {themeData.filter((t) => t.total >= 3 && t.accuracy < 30).map((t) => (
            <p key={t.theme} className="text-xs text-[#F59E0B]">
              「{t.label}」の正答率が{t.accuracy}%と低い（{t.total}件中）。情報源の見直しを検討
            </p>
          ))}
          {overconfident.length === 0 && underconfident.length === 0 && themeData.every((t) => t.total < 3 || t.accuracy >= 30) && (
            <p className="text-xs text-[#10B981]">現時点で顕著なバイアスは検出されていません</p>
          )}
        </div>
      </div>
    </div>
  );
}
