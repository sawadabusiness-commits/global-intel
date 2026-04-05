import { NextRequest, NextResponse } from "next/server";
import { fetchAllGdeltData, fetchAllDataSources, detectAnomalies, fetchShowHN } from "@/lib/osint";
import { batchVerifyWithOsint, generateNovelArticle, generateWeeklyDeepDive, batchDeepAnalyze, updateNarratives } from "@/lib/github-models";
import {
  getArticles, getLatestDate, saveArticles,
  saveOsintSnapshot, getOsintSnapshot, getLatestOsintDate,
  saveOsintVerifications, saveOsintArticles,
  saveWeeklyDeepDive, getWeeklyDeepDive,
  getMemory, saveMemory,
} from "@/lib/kv";
import { THEME_MAP } from "@/lib/themes";
import { updateKeyIndicators, formatIndicatorContext, formatThemeContext, formatWeeklyContext, buildNarrativeUpdateInput, createEmptyMemory } from "@/lib/memory";
import type { OsintSnapshot, OsintArticle, ThemeId, WeeklyDeepDive, AnalyzedArticle } from "@/lib/types";

export const maxDuration = 60;

function isSaturday(): boolean {
  // Cron runs at 20:00 UTC Friday = Saturday 5:00 JST
  // Check if "today" in JST is Saturday
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.getDay() === 6;
}

function getWeekDates(baseDate: string): { start: string; end: string; dates: string[] } {
  const end = new Date(baseDate);
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return { start: dates[0], end: dates[dates.length - 1], dates };
}

function pickTopTheme(articles: AnalyzedArticle[]): ThemeId | null {
  const counts = new Map<ThemeId, number>();
  for (const a of articles) {
    counts.set(a.primary_theme, (counts.get(a.primary_theme) ?? 0) + 1);
  }
  let maxTheme: ThemeId | null = null;
  let maxCount = 0;
  for (const [theme, count] of counts) {
    if (count > maxCount) { maxCount = count; maxTheme = theme; }
  }
  return maxTheme;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = jst.toISOString().split("T")[0];
  const result: Record<string, unknown> = { ok: true, date: today };

  const startTime = Date.now();

  try {
    // 0. メモリ読み込み（~50ms）
    const memory = await getMemory();

    // 1. 全データソース並列取得（~5-10秒）
    const [gdeltData, freshDataPoints] = await Promise.all([
      fetchAllGdeltData(),
      fetchAllDataSources(),
    ]);

    // 賃金データは週1取得のため、取れなかった日は前回スナップショットから引き継ぐ
    let dataPoints = freshDataPoints;
    const hasWageData = freshDataPoints.some((dp) => dp.indicator.startsWith("wage_"));
    if (!hasWageData) {
      const prevDate = await getLatestOsintDate();
      if (prevDate) {
        const prevSnapshot = await getOsintSnapshot(prevDate);
        const prevWages = prevSnapshot?.data_points?.filter((dp) => dp.indicator.startsWith("wage_")) ?? [];
        dataPoints = [...freshDataPoints, ...prevWages];
      }
    }

    const anomalies = detectAnomalies(gdeltData, dataPoints);

    const snapshot: OsintSnapshot = {
      date: today,
      gdelt: gdeltData,
      data_points: dataPoints,
      anomalies,
      created_at: new Date().toISOString(),
    };
    await saveOsintSnapshot(snapshot);

    // ソース別の集計
    const sourceCounts: Record<string, number> = {};
    for (const dp of dataPoints) {
      sourceCounts[dp.source] = (sourceCounts[dp.source] ?? 0) + 1;
    }
    result.gdelt_themes = gdeltData.length;
    result.data_sources = sourceCounts;
    result.total_data_points = dataPoints.length;
    result.anomalies = anomalies.length;

    // 2. 深層分析補完: /api/cron で未完了の記事を補完（~20秒）
    const latestDate = await getLatestDate();
    if (latestDate) {
      const articles = await getArticles(latestDate);
      const needsDeep = articles.filter((a) => !a.analysis);
      if (needsDeep.length > 0) {
        try {
          const memoryCtxFn = memory ? (themeId: string) => formatThemeContext(memory, themeId as ThemeId) : undefined;
          const deepResults = await batchDeepAnalyze(
            needsDeep.map((a) => ({
              title: a.title_en,
              source: a.source,
              published: a.published,
              region: a.region,
              summary: a.summary_ja,
              primary_theme: a.primary_theme,
            })),
            18000,
            memoryCtxFn,
          );
          let backfilled = 0;
          const articleMap = new Map(articles.map((a) => [a.id, a]));
          for (let i = 0; i < needsDeep.length; i++) {
            const deep = deepResults[i];
            if (!deep) continue;
            const orig = articleMap.get(needsDeep[i].id);
            if (orig) {
              orig.analysis = {
                primary_theme: orig.primary_theme,
                cross_themes: orig.cross_themes,
                impact: orig.impact,
                timeframe: orig.timeframe,
                title_ja: orig.title_ja,
                summary_ja: orig.summary_ja,
                ...deep,
              } as any;
              backfilled++;
            }
          }
          if (backfilled > 0) {
            await saveArticles(latestDate, articles);
          }
          result.deep_backfilled = backfilled;
          result.deep_remaining = needsDeep.length - backfilled;
        } catch (e) {
          console.error("Deep analysis backfill failed:", e);
        }
      }
    }

    // 3. アナリスト4: 今日の記事をOSINTデータで検証（~10秒）
    if (latestDate) {
      const articles = await getArticles(latestDate);
      if (articles.length > 0) {
        try {
          const indicatorCtx = memory ? formatIndicatorContext(memory.key_indicators) : undefined;
          const verifications = await batchVerifyWithOsint(
            articles.map((a) => ({
              id: a.id,
              title_ja: a.title_ja,
              summary_ja: a.summary_ja,
              primary_theme: a.primary_theme,
            })),
            gdeltData,
            dataPoints,
            indicatorCtx || undefined,
          );
          await saveOsintVerifications(latestDate, verifications);
          result.verified = verifications.length;
        } catch (e) {
          console.error("Analyst 4 verification failed:", e);
          result.verification_error = String(e);
        }
      }
    }

    // 4. アナリスト5: 異常値があれば独自記事生成（~10秒）
    if (anomalies.length > 0) {
      try {
        const novelCtx = memory ? formatIndicatorContext(memory.key_indicators) : undefined;
        const novelArticle = await generateNovelArticle(anomalies, gdeltData, dataPoints, novelCtx || undefined);
        if (novelArticle) {
          await saveOsintArticles(today, [novelArticle]);
          result.novel_article = novelArticle.title;
        }
      } catch (e) {
        console.error("Analyst 5 novel article failed:", e);
      }
    }

    // 5. 土曜日: 週次ディープダイブも生成（~15秒）
    const forceWeekly = req.nextUrl.searchParams.get("force_weekly") === "1";
    if (isSaturday() || forceWeekly) {
      try {
        const { start, end, dates } = getWeekDates(today);
        const existing = forceWeekly ? null : await getWeeklyDeepDive(end);
        if (!existing) {
          const allArticles: AnalyzedArticle[] = [];
          for (const date of dates) {
            const arts = await getArticles(date);
            allArticles.push(...arts);
          }
          if (allArticles.length > 0) {
            const themeId = pickTopTheme(allArticles);
            if (themeId) {
              const theme = THEME_MAP[themeId];
              const themeArticles = allArticles.filter(
                (a) => a.primary_theme === themeId || a.cross_themes.includes(themeId)
              );
              const showHN = await fetchShowHN(7, 15).catch(() => []);
              const weeklyCtx = memory ? formatWeeklyContext(memory.weekly_summaries) : undefined;
              const report = await generateWeeklyDeepDive(
                theme.labelJa,
                themeArticles.map((a) => ({ title_ja: a.title_ja, summary_ja: a.summary_ja, published: a.published })),
                showHN,
                dataPoints,
                weeklyCtx || undefined,
              );
              const deepDive: WeeklyDeepDive = {
                id: `dd-${end}`, week_start: start, week_end: end,
                theme: themeId, theme_label_ja: theme.labelJa,
                article_count: themeArticles.length, report,
                created_at: new Date().toISOString(),
              };
              await saveWeeklyDeepDive(deepDive);
              result.deep_dive = { theme: theme.labelJa, articles: themeArticles.length };
            }
          }
        }
      } catch (e) {
        console.error("Weekly deep dive failed:", e);
        result.deep_dive_error = String(e);
      }
    }

    // 6. インテリジェンス・メモリ更新
    const elapsed = Date.now() - startTime;
    const remainingMs = 55000 - elapsed;
    if (remainingMs > 8000) {
      try {
        const currentMemory = memory ?? createEmptyMemory(today);

        // Phase 1: 指標トラッカー更新（コード処理のみ）
        const updatedIndicators = updateKeyIndicators(currentMemory, dataPoints, today);

        // Phase 2: テーマナラティブ更新（AI 1回、残り時間が十分な場合のみ）
        let updatedNarratives = currentMemory.theme_narratives;
        const latestArticles = latestDate ? await getArticles(latestDate) : [];
        const narrativeRemaining = 55000 - (Date.now() - startTime);
        if (narrativeRemaining > 10000 && latestArticles.length > 0) {
          const narrativeInput = buildNarrativeUpdateInput(
            currentMemory,
            latestArticles,
            anomalies,
            updatedIndicators,
          );
          updatedNarratives = await updateNarratives(narrativeInput, today, currentMemory.theme_narratives);
        }

        // 週次サマリー追記（土曜のみ）
        let weeklySummaries = currentMemory.weekly_summaries;
        if ((isSaturday() || forceWeekly) && result.deep_dive) {
          const dd = result.deep_dive as { theme: string; articles: number };
          weeklySummaries = [
            {
              week_end: today,
              theme: pickTopTheme(latestArticles) ?? "geopolitics",
              one_liner: dd.theme,
              key_numbers: updatedIndicators
                .filter((k) => k.change != null)
                .slice(0, 3)
                .map((k) => `${k.label}${k.current_value}`),
            },
            ...weeklySummaries,
          ].slice(0, 4);
        }

        const updatedMemory = {
          date: today,
          version: currentMemory.version + 1,
          key_indicators: updatedIndicators,
          theme_narratives: updatedNarratives,
          weekly_summaries: weeklySummaries,
        };
        await saveMemory(updatedMemory);
        result.memory_updated = true;
        result.memory_version = updatedMemory.version;
        result.indicators_tracked = updatedIndicators.length;
      } catch (e) {
        console.error("Memory update failed:", e);
        result.memory_error = String(e);
      }
    } else {
      result.memory_skipped = `残り${remainingMs}ms、8秒未満のため���キップ`;
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("OSINT cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
