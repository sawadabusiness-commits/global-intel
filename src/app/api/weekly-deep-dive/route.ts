import { NextRequest, NextResponse } from "next/server";
import { getArticles, saveWeeklyDeepDive, getWeeklyDeepDive } from "@/lib/kv";
import { generateWeeklyDeepDive } from "@/lib/github-models";
import { THEME_MAP } from "@/lib/themes";
import type { ThemeId, WeeklyDeepDive, AnalyzedArticle } from "@/lib/types";

export const maxDuration = 60;

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
    if (count > maxCount) {
      maxCount = count;
      maxTheme = theme;
    }
  }
  return maxTheme;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const { start, end, dates } = getWeekDates(today);

  // 既に生成済みならスキップ
  const existing = await getWeeklyDeepDive(end);
  if (existing) {
    return NextResponse.json({ ok: true, message: "Already generated", week_end: end });
  }

  try {
    // 7日分の記事を収集
    const allArticles: AnalyzedArticle[] = [];
    for (const date of dates) {
      const articles = await getArticles(date);
      allArticles.push(...articles);
    }

    if (allArticles.length === 0) {
      return NextResponse.json({ ok: true, message: "No articles for the week" });
    }

    // 最も記事数が多いテーマを選定
    const themeId = pickTopTheme(allArticles);
    if (!themeId) {
      return NextResponse.json({ ok: true, message: "No theme found" });
    }

    const themeArticles = allArticles.filter(
      (a) => a.primary_theme === themeId || a.cross_themes.includes(themeId)
    );

    const theme = THEME_MAP[themeId];

    // レポート生成
    const report = await generateWeeklyDeepDive(
      theme.labelJa,
      themeArticles.map((a) => ({
        title_ja: a.title_ja,
        summary_ja: a.summary_ja,
        published: a.published,
      }))
    );

    const deepDive: WeeklyDeepDive = {
      id: `dd-${end}`,
      week_start: start,
      week_end: end,
      theme: themeId,
      theme_label_ja: theme.labelJa,
      article_count: themeArticles.length,
      report,
      created_at: new Date().toISOString(),
    };

    await saveWeeklyDeepDive(deepDive);

    return NextResponse.json({
      ok: true,
      week: `${start} ~ ${end}`,
      theme: theme.labelJa,
      article_count: themeArticles.length,
    });
  } catch (e) {
    console.error("Weekly deep dive error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
