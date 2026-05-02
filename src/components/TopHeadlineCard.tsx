"use client";

import { useState } from "react";
import { THEME_MAP, IMPACT_LEVELS, TIMEFRAMES } from "@/lib/themes";
import type { AnalyzedArticle, GeminiAnalysis, HeadlineSelection, OsintVerification } from "@/lib/types";
import AnalystTabs from "./AnalystTabs";
import MermaidDiagram from "./MermaidDiagram";

interface Props {
  article: AnalyzedArticle;
  headline: HeadlineSelection;
  date: string;
  isRead: boolean;
  onRead: (id: string) => void;
  osintVerification?: OsintVerification;
}

export default function TopHeadlineCard({ article, headline, date, isRead, onRead, osintVerification }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(article.analysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = THEME_MAP[article.primary_theme];
  const impact = IMPACT_LEVELS[article.impact];
  const timeframe = TIMEFRAMES[article.timeframe];
  const accentColor = theme?.color ?? "#EF4444";

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

  function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      if (!isRead) onRead(article.id);
      if (!analysis && !loading) fetchAnalysis();
    }
  }

  return (
    <article
      className="rounded-xl overflow-hidden cursor-pointer mb-6"
      style={{
        border: `1px solid ${accentColor}40`,
        borderLeft: `4px solid ${accentColor}`,
        opacity: isRead && !expanded ? 0.7 : 1,
      }}
      onClick={handleExpand}
    >
      {/* Badge bar */}
      <div
        className="px-5 py-2 flex items-center gap-3"
        style={{ background: accentColor + "18" }}
      >
        <span
          className="text-[10px] font-mono font-bold tracking-widest"
          style={{ color: accentColor }}
        >
          ★ TODAY&apos;S HEADLINE
        </span>
        <div className="flex items-center gap-2 ml-auto">
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
          <span className="text-[10px] font-mono text-[var(--muted)]">
            {article.published?.split(" ")[0]}
          </span>
        </div>
      </div>

      {/* Main body */}
      <div className="p-5" style={{ background: "var(--surface)" }}>
        {/* Theme + title */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
            style={{ background: accentColor + "20", color: accentColor }}
          >
            {theme?.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-[#E2E8F0] leading-snug">
              {article.title_ja}
            </h2>
            <p className="text-[11px] text-[var(--muted)] mt-0.5 truncate">{article.title_en}</p>
          </div>
        </div>

        {/* Reason */}
        <div
          className="rounded-lg p-3 mb-2"
          style={{ background: "var(--surface-2)", borderLeft: `3px solid ${accentColor}` }}
        >
          <p className="text-[10px] font-mono text-[var(--muted)] mb-1 uppercase tracking-wider">
            ヘッドライン選定理由
          </p>
          <p className="text-xs text-[#E2E8F0] leading-relaxed">{headline.reason}</p>
        </div>

        {/* So what */}
        <div
          className="rounded-lg p-3 mb-4"
          style={{ background: "#38BDF810", borderLeft: "3px solid #38BDF8" }}
        >
          <p className="text-[10px] font-mono text-[#38BDF8] mb-1 uppercase tracking-wider">
            あなたへの示唆
          </p>
          <p className="text-xs text-[#E2E8F0] leading-relaxed">{headline.so_what}</p>
        </div>

        {/* Summary */}
        <p className="text-xs text-[var(--muted)] leading-relaxed mb-4">{article.summary_ja}</p>

        {/* Source */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--muted)]">
          <span>{article.source}</span>
          <span>{article.region}</span>
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

        {/* Expanded: deep analysis */}
        {expanded && (
          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
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
                  className="px-3 py-1 text-xs rounded bg-[var(--surface-2)] text-[var(--muted)] hover:text-[#E2E8F0]"
                >
                  再試行
                </button>
              </div>
            )}
            {article.mermaid && (
              <div className="mt-4 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                <div className="text-[10px] font-mono text-[var(--muted)] mb-2">図解</div>
                <MermaidDiagram code={article.mermaid} id={article.id} />
              </div>
            )}
            {analysis && (
              <AnalystTabs
                analysis={analysis}
                articleId={article.id}
                articleTitle={article.title_ja}
                osintVerification={osintVerification}
              />
            )}
          </div>
        )}
      </div>
    </article>
  );
}
