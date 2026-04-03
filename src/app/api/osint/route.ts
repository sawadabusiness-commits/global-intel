import { NextRequest, NextResponse } from "next/server";
import { fetchAllGdeltData, fetchAllDataSources, detectAnomalies, fetchShowHN } from "@/lib/osint";
import { batchVerifyWithOsint, generateNovelArticle, generateWeeklyDeepDive, batchDeepAnalyze } from "@/lib/github-models";
import {
  getArticles, getLatestDate, saveArticles,
  saveOsintSnapshot, saveOsintVerifications, saveOsintArticles,
  saveWeeklyDeepDive, getWeeklyDeepDive,
} from "@/lib/kv";
import { THEME_MAP } from "@/lib/themes";
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

  const today = new Date().toISOString().split("T")[0];
  const result: Record<string, unknown> = { ok: true, date: today };

  try {
    // 1. 全データソース並列取得（~5-10秒）
    const [gdeltData, dataPoints] = await Promise.all([
      fetchAllGdeltData(),
      fetchAllDataSources(),
    ]);
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
          const deepResults = await batchDeepAnalyze(
            needsDeep.map((a) => ({
              title: a.title_en,
              source: a.source,
              published: a.published,
              region: a.region,
              summary: a.summary_ja,
            })),
            25000,
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
          const verifications = await batchVerifyWithOsint(
            articles.map((a) => ({
              id: a.id,
              title_ja: a.title_ja,
              summary_ja: a.summary_ja,
              primary_theme: a.primary_theme,
            })),
            gdeltData,
            dataPoints
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
        const novelArticle = await generateNovelArticle(anomalies, gdeltData, dataPoints);
        if (novelArticle) {
          await saveOsintArticles(today, [novelArticle]);
          result.novel_article = novelArticle.title;
        }
      } catch (e) {
        console.error("Analyst 5 novel article failed:", e);
      }
    }

    // 5. 土曜日: 週次ディープダイブも生成（~15秒）
    if (isSaturday()) {
      try {
        const { start, end, dates } = getWeekDates(today);
        const existing = await getWeeklyDeepDive(end);
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
              const report = await generateWeeklyDeepDive(
                theme.labelJa,
                themeArticles.map((a) => ({ title_ja: a.title_ja, summary_ja: a.summary_ja, published: a.published })),
                showHN,
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

    return NextResponse.json(result);
  } catch (e) {
    console.error("OSINT cron error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
