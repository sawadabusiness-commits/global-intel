"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalyzedArticle, ThemeId, OsintVerification, OsintArticle, OsintAnomaly, IntelligenceMemory } from "@/lib/types";
import { THEMES, THEME_MAP } from "@/lib/themes";
import ThemeFilter from "./ThemeFilter";
import ArticleCard from "./ArticleCard";
import IntelBriefing from "./IntelBriefing";

interface Props {
  articles: AnalyzedArticle[];
  date: string;
  osintVerifications?: OsintVerification[];
  osintArticles?: OsintArticle[];
  anomalies?: OsintAnomaly[];
  memory?: IntelligenceMemory | null;
}

function getReadIds(date: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(`read:${date}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveReadIds(date: string, ids: Set<string>) {
  localStorage.setItem(`read:${date}`, JSON.stringify([...ids]));
}

export default function Dashboard({ articles, date, osintVerifications = [], osintArticles = [], anomalies = [], memory = null }: Props) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [hideRead, setHideRead] = useState(false);

  useEffect(() => {
    setReadIds(getReadIds(date));
  }, [date]);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(date, next);
      return next;
    });
  }, [date]);

  const filtered = articles.filter((a) => {
    if (selectedTheme && a.primary_theme !== selectedTheme && !a.cross_themes.includes(selectedTheme)) {
      return false;
    }
    if (hideRead && readIds.has(a.id)) return false;
    return true;
  });

  const unreadOsint = osintArticles.filter((oa) => !readIds.has(oa.id)).length;
  const unreadCount = articles.filter((a) => !readIds.has(a.id)).length + unreadOsint;

  // OSINT検証マップ
  const verificationMap = new Map(osintVerifications.map((v) => [v.article_id, v]));

  // テーマ別未読数
  const themeCounts = THEMES.map((t) => {
    const themeArticles = articles.filter(
      (a) => a.primary_theme === t.id || a.cross_themes.includes(t.id)
    );
    return {
      ...t,
      total: themeArticles.length,
      unread: themeArticles.filter((a) => !readIds.has(a.id)).length,
    };
  });

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
          <a href="/deep-dive" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]">
            Weekly Deep Dive
          </a>
          <a href="/practice" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]">
            補助金・助成金
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
              <span className="font-mono text-[10px]">
                {t.unread > 0 ? (
                  <span style={{ color: t.color }}>{t.unread}</span>
                ) : (
                  <span style={{ opacity: 0.3 }}>{t.total}</span>
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-6 space-y-2">
          <button
            onClick={() => setHideRead(!hideRead)}
            className="w-full px-3 py-2 rounded-lg text-[10px] font-mono transition-all"
            style={{
              background: hideRead ? "var(--surface-2)" : "transparent",
              color: hideRead ? "#E2E8F0" : "var(--muted)",
              border: `1px solid ${hideRead ? "var(--border)" : "transparent"}`,
            }}
          >
            {hideRead ? "全記事を表示" : "既読を非表示"}
          </button>
          <div className="p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
            <p className="text-[10px] font-mono text-[var(--muted)]">
              {unreadCount > 0 ? (
                <><span className="text-[#38BDF8]">{unreadCount}</span> / {articles.length} 未読</>
              ) : (
                <>{articles.length} articles - all read</>
              )}
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

        {/* インテリジェンス・ブリーフィング */}
        {!selectedTheme && (
          <IntelBriefing anomalies={anomalies} memory={memory} date={date} />
        )}

        {/* OSINT独自記事 */}
        {osintArticles.length > 0 && !selectedTheme && !(hideRead && unreadOsint === 0) && (
          <div className="mb-6">
            <h3 className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="text-[#22D3EE]">OSINT</span> Intelligence Articles
            </h3>
            <div className="space-y-3">
              {osintArticles.filter((oa) => !(hideRead && readIds.has(oa.id))).map((oa) => {
                const t = THEME_MAP[oa.theme];
                const isOsintRead = readIds.has(oa.id);
                return (
                  <div
                    key={oa.id}
                    className="rounded-xl p-4 cursor-pointer transition-opacity"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid #22D3EE30",
                      opacity: isOsintRead ? 0.5 : 1,
                    }}
                    onClick={() => { if (!isOsintRead) markAsRead(oa.id); }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-sm mt-0.5" style={{ color: "#22D3EE" }}>
                        {isOsintRead ? "✓" : "OSINT"}
                      </span>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-[#E2E8F0]">{oa.title}</h4>
                        <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed whitespace-pre-wrap">{oa.body}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono" style={{ background: (t?.color ?? "#666") + "20", color: t?.color }}>
                            {t?.labelJa}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono" style={{ background: "#22D3EE20", color: "#22D3EE" }}>
                            確信度: {oa.confidence}
                          </span>
                          {oa.data_sources.map((ds, i) => (
                            <span key={i} className="text-[10px] font-mono text-[var(--muted)]">{ds}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 記事一覧 */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[var(--muted)] text-sm">
              {hideRead && articles.length > 0 ? "未読の記事はありません" : "記事がありません"}
            </p>
            {hideRead && articles.length > 0 && (
              <button
                onClick={() => setHideRead(false)}
                className="text-[10px] text-[#38BDF8] mt-2 hover:text-[#7DD3FC]"
              >
                全記事を表示
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                date={date}
                isRead={readIds.has(article.id)}
                onRead={markAsRead}
                osintVerification={verificationMap.get(article.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
