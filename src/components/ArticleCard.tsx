"use client";

import { useState } from "react";
import { THEME_MAP, IMPACT_LEVELS, TIMEFRAMES } from "@/lib/themes";
import type { AnalyzedArticle } from "@/lib/types";
import AnalystTabs from "./AnalystTabs";

interface Props {
  article: AnalyzedArticle;
}

export default function ArticleCard({ article }: Props) {
  const [expanded, setExpanded] = useState(false);
  const theme = THEME_MAP[article.primary_theme];
  const impact = IMPACT_LEVELS[article.impact];
  const timeframe = TIMEFRAMES[article.timeframe];

  return (
    <article
      className="rounded-xl p-5 transition-all cursor-pointer"
      style={{
        background: "var(--surface)",
        border: `1px solid ${expanded ? theme?.color + "40" : "var(--border)"}`,
      }}
      onClick={() => setExpanded(!expanded)}
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
          <AnalystTabs analysis={article.analysis} />
        </div>
      )}
    </article>
  );
}
