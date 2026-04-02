"use client";

import { useState } from "react";
import { THEME_MAP, IMPACT_LEVELS, TIMEFRAMES } from "@/lib/themes";
import type { AnalyzedArticle, GeminiAnalysis, OsintVerification } from "@/lib/types";
import AnalystTabs from "./AnalystTabs";

const VERDICT_STYLES = {
  supported: { label: "OSINT裏付け", color: "#10B981" },
  contradicted: { label: "OSINT矛盾", color: "#EF4444" },
  unverifiable: { label: "OSINT検証不能", color: "#6366F1" },
} as const;

interface Props {
  article: AnalyzedArticle;
  date: string;
  isRead?: boolean;
  onRead?: (id: string) => void;
  osintVerification?: OsintVerification;
}

export default function ArticleCard({ article, date, isRead, onRead, osintVerification }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(article.analysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = THEME_MAP[article.primary_theme];
  const impact = IMPACT_LEVELS[article.impact];
  const timeframe = TIMEFRAMES[article.timeframe];

  async function fetchAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id, date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "分析に失敗しました");
      setAnalysis(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);

    if (next) {
      // 既読マーク
      if (!isRead && onRead) onRead(article.id);
      // 展開時、分析データがなければ取得
      if (!analysis && !loading) fetchAnalysis();
    }
  }

  return (
    <article
      className="rounded-xl p-5 transition-all cursor-pointer"
      style={{
        background: "var(--surface)",
        border: `1px solid ${expanded ? theme?.color + "40" : "var(--border)"}`,
        opacity: isRead && !expanded ? 0.5 : 1,
      }}
      onClick={handleExpand}
    >
      {/* ヘッダー */}
      <div className="flex items-start gap-3">
        <div
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
          style={{ background: (theme?.color ?? "#666") + "20", color: theme?.color }}
        >
          {theme?.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-[#E2E8F0] leading-snug">
            {article.title_ja}
          </h3>
          <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{article.title_en}</p>
        </div>
      </div>

      {/* メタ情報 */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-mono"
          style={{ background: (theme?.color ?? "#666") + "20", color: theme?.color }}
        >
          {theme?.labelJa}
        </span>
        {article.cross_themes.slice(0, 3).map((t) => {
          const ct = THEME_MAP[t];
          return (
            <span
              key={t}
              className="px-2 py-0.5 rounded-full text-[10px] font-mono"
              style={{ background: (ct?.color ?? "#666") + "10", color: ct?.color ?? "#666" }}
            >
              {ct?.labelJa}
            </span>
          );
        })}
        {osintVerification && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono"
            style={{
              background: VERDICT_STYLES[osintVerification.verdict].color + "20",
              color: VERDICT_STYLES[osintVerification.verdict].color,
            }}
            title={osintVerification.evidence}
          >
            {VERDICT_STYLES[osintVerification.verdict].label}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono"
            style={{ background: impact.color + "20", color: impact.color }}
          >
            {impact.labelJa}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono"
            style={{ background: timeframe.color + "20", color: timeframe.color }}
          >
            {timeframe.labelJa}
          </span>
        </span>
      </div>

      {/* サマリ */}
      <p className="text-xs text-[var(--muted)] mt-3 leading-relaxed">
        {article.summary_ja}
      </p>

      {/* ソース */}
      <div className="flex items-center gap-3 mt-3 text-[10px] font-mono text-[var(--muted)]">
        <span>{article.source}</span>
        <span>{article.region}</span>
        <span>{article.published?.split(" ")[0]}</span>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto hover:text-[#38BDF8]"
          onClick={(e) => e.stopPropagation()}
        >
          Source →
        </a>
      </div>

      {/* 展開時: 3層分析 */}
      {expanded && (
        <div onClick={(e) => e.stopPropagation()}>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-5 w-5 border-2 border-[var(--muted)] border-t-transparent rounded-full" />
              <span className="ml-3 text-xs text-[var(--muted)]">深層分析を実行中...</span>
            </div>
          )}
          {error && (
            <div className="py-4 text-center">
              <p className="text-xs text-red-400 mb-2">{error}</p>
              <button
                onClick={fetchAnalysis}
                className="px-3 py-1 text-xs rounded bg-[var(--surface-2)] text-[var(--muted)] hover:text-[#E2E8F0] transition-colors"
              >
                再試行
              </button>
            </div>
          )}
          {analysis && <AnalystTabs analysis={analysis} articleId={article.id} articleTitle={article.title_ja} osintVerification={osintVerification} />}
        </div>
      )}
    </article>
  );
}
