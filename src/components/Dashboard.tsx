"use client";

import { useState } from "react";
import type { AnalyzedArticle, ThemeId } from "@/lib/types";
import { THEMES } from "@/lib/themes";
import ThemeFilter from "./ThemeFilter";
import ArticleCard from "./ArticleCard";

interface Props {
  articles: AnalyzedArticle[];
  date: string;
}

export default function Dashboard({ articles, date }: Props) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId | null>(null);

  const filtered = selectedTheme
    ? articles.filter(
        (a) => a.primary_theme === selectedTheme || a.cross_themes.includes(selectedTheme)
      )
    : articles;

  // テーマ別記事数
  const themeCounts = THEMES.map((t) => ({
    ...t,
    count: articles.filter(
      (a) => a.primary_theme === t.id || a.cross_themes.includes(t.id)
    ).length,
  }));

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
        <p className="text-[10px] font-mono text-[var(--muted)] mb-6">{date}</p>

        <nav className="space-y-1 mb-6">
          <a href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-[var(--surface-2)] text-[#E2E8F0]">
            Dashboard
          </a>
          <a href="/tracker" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]">
            Prediction Tracker
          </a>
        </nav>

        <h3 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider mb-3">
          Theme Distribution
        </h3>
        <div className="space-y-2">
          {themeCounts.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTheme(selectedTheme === t.id ? null : t.id)}
              className="flex items-center gap-2 w-full text-left px-2 py-1 rounded text-xs transition-all hover:bg-[var(--surface-2)]"
              style={{ color: selectedTheme === t.id ? t.color : "var(--muted)" }}
            >
              <span style={{ color: t.color }}>{t.icon}</span>
              <span className="flex-1">{t.labelJa}</span>
              <span className="font-mono text-[10px]">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-6">
          <div className="p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
            <p className="text-[10px] font-mono text-[var(--muted)]">
              {articles.length} articles analyzed
            </p>
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 p-6">
        {/* モバイルヘッダー */}
        <div className="lg:hidden mb-6">
          <h1 className="text-2xl" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Global Intel
          </h1>
          <p className="text-xs font-mono text-[var(--muted)]">{date}</p>
        </div>

        {/* テーマフィルタ */}
        <div className="mb-6">
          <ThemeFilter selected={selectedTheme} onSelect={setSelectedTheme} />
        </div>

        {/* 記事一覧 */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[var(--muted)] text-sm">記事がありません</p>
            <p className="text-[var(--muted)] text-xs mt-1">Cronジョブ実行後に表示されます</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((article) => (
              <ArticleCard key={article.id} article={article} date={date} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
