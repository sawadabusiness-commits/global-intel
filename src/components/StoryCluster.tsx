"use client";

import { useState } from "react";
import { THEME_MAP } from "@/lib/themes";
import type { AnalyzedArticle, ClusterGroup, OsintVerification } from "@/lib/types";
import ArticleCard from "./ArticleCard";

interface Props {
  cluster: ClusterGroup;
  articles: AnalyzedArticle[];
  date: string;
  readIds: Set<string>;
  onRead: (id: string) => void;
  verificationMap: Map<string, OsintVerification>;
  hideRead: boolean;
}

export default function StoryCluster({ cluster, articles, date, readIds, onRead, verificationMap, hideRead }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const theme = THEME_MAP[cluster.theme];
  const accentColor = theme?.color ?? "#94A3B8";

  const clusterArticles = articles.filter((a) => cluster.article_ids.includes(a.id));
  const visible = hideRead ? clusterArticles.filter((a) => !readIds.has(a.id)) : clusterArticles;

  if (hideRead && visible.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden mb-4"
      style={{ border: `1px solid ${accentColor}30`, borderLeft: `3px solid ${accentColor}` }}
    >
      {/* Cluster header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: accentColor + "10" }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span style={{ color: accentColor }}>{theme?.icon ?? "◆"}</span>
        <span className="flex-1 text-xs font-semibold text-[#E2E8F0] tracking-wide">
          {cluster.label}
        </span>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ background: accentColor + "20", color: accentColor }}
        >
          {clusterArticles.length}記事
        </span>
        <span className="text-[10px] text-[var(--muted)] ml-1">{collapsed ? "▶" : "▼"}</span>
      </button>

      {/* Narrative */}
      {!collapsed && (
        <div
          className="mx-4 mt-3 mb-1 px-3 py-2 rounded-lg text-xs leading-relaxed text-[#CBD5E1]"
          style={{ background: "var(--surface-2)", borderLeft: `2px solid ${accentColor}` }}
        >
          <span
            className="font-mono text-[9px] tracking-wider mr-2"
            style={{ color: accentColor }}
          >
            今日の総括
          </span>
          {cluster.narrative}
        </div>
      )}

      {/* Article cards */}
      {!collapsed && (
        <div className="px-4 pb-4 pt-2 space-y-3">
          {visible.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              date={date}
              isRead={readIds.has(article.id)}
              onRead={onRead}
              osintVerification={verificationMap.get(article.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
