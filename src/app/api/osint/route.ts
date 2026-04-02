import { NextRequest, NextResponse } from "next/server";
import { fetchAllGdeltData, detectAnomalies } from "@/lib/osint";
import { batchVerifyWithOsint, generateNovelArticle, generateWeeklyDeepDive } from "@/lib/github-models";
import {
  getArticles, getLatestDate,
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
    // 1. GDELTデータ取得（6テーマ並列、~5秒）
    let gdeltData = await fetchAllGdeltData();
    const anomalies = detectAnomalies(gdeltData);

    const snapshot: OsintSnapshot = {
      date: today,
      gdelt: gdeltData,
      anomalies,
      created_at: new Date().toISOString(),
    };
    await saveOsintSnapshot(snapshot);
    result.gdelt_themes = gdeltData.length;
    result.anomalies = anomalies.length;

    // 2. アナリスト4: 今日の記事をOSINTデータで検証（~10秒）
    const latestDate = await getLatestDate();
    if (latestDate && gdeltData.length > 0) {
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
            gdeltData
          );
          await saveOsintVerifications(latestDate, verifications);
          result.verified = verifications.length;
        } catch (e) {
          console.error("Analyst 4 verification failed:", e);
          result.verification_error = String(e);
        }
      }
    }

    // 3. アナリスト5: 異常値があれば独自記事生成（~10秒）
    if (anomalies.length > 0) {
      try {
        const novelArticle = await generateNovelArticle(anomalies, gdeltData);
        if (novelArticle) {
          await saveOsintArticles(today, [novelArticle]);
          result.novel_article = novelArticle.title;
        }
      } catch (e) {
        console.error("Analyst 5 novel article failed:", e);
      }
    }

    // 4. 土曜日: 週次ディープダイブも生成（~15秒）
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
              const report = await generateWeeklyDeepDive(
                theme.labelJa,
                themeArticles.map((a) => ({ title_ja: a.title_ja, summary_ja: a.summary_ja, published: a.published }))
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
