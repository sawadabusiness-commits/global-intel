import { NextRequest, NextResponse } from "next/server";
import { getOsintSnapshot, getLatestOsintDate, getLatestDate, getArticles, getWeeklyDeepDive, getLatestDeepDiveDate, getMemory } from "@/lib/kv";

export const maxDuration = 10;

/**
 * GET /api/data — KV蓄積データの読み出しAPI
 *
 * クエリパラメータ:
 *   type=osint|articles|deepdive|memory|summary  (default: summary)
 *   date=YYYY-MM-DD  (省略時: latest)
 *   source=fred|boj|estat|...  (osint時のフィルタ)
 *   indicator=FEDFUNDS|UNRATE|...  (osint時のフィルタ)
 *   country=USA|JPN|...  (osint時のフィルタ)
 *   category=macro|finance|price|...  (osint時のフィルタ)
 *   q=キーワード  (label部分一致検索)
 *
 * 認証: CRON_SECRETをBearerトークンまたは?secret=で渡す
 */
export async function GET(req: NextRequest) {
  // 認証チェック
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const token = authHeader?.replace("Bearer ", "") ?? querySecret;
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const params = req.nextUrl.searchParams;
  const type = params.get("type") ?? "summary";
  const dateParam = params.get("date");

  try {
    switch (type) {
      case "osint": {
        const date = dateParam ?? (await getLatestOsintDate());
        if (!date) return NextResponse.json({ error: "No OSINT data yet" }, { status: 404 });

        const snapshot = await getOsintSnapshot(date);
        if (!snapshot) return NextResponse.json({ error: `No data for ${date}` }, { status: 404 });

        let points = snapshot.data_points;

        // フィルタ適用
        const source = params.get("source");
        const indicator = params.get("indicator");
        const country = params.get("country");
        const category = params.get("category");
        const q = params.get("q");

        if (source) points = points.filter((p) => p.source === source);
        if (indicator) points = points.filter((p) => p.indicator === indicator);
        if (country) points = points.filter((p) => p.country === country);
        if (category) points = points.filter((p) => p.category === category);
        if (q) {
          const lower = q.toLowerCase();
          points = points.filter((p) => p.label.toLowerCase().includes(lower) || p.indicator.toLowerCase().includes(lower));
        }

        return NextResponse.json({
          date: snapshot.date,
          total: points.length,
          anomalies: snapshot.anomalies,
          data_points: points,
        });
      }

      case "articles": {
        const date = dateParam ?? (await getLatestDate());
        if (!date) return NextResponse.json({ error: "No articles yet" }, { status: 404 });
        const articles = await getArticles(date);
        return NextResponse.json({ date, total: articles.length, articles });
      }

      case "deepdive": {
        const date = dateParam ?? (await getLatestDeepDiveDate());
        if (!date) return NextResponse.json({ error: "No deep dive yet" }, { status: 404 });
        const deepDive = await getWeeklyDeepDive(date);
        if (!deepDive) return NextResponse.json({ error: `No deep dive for ${date}` }, { status: 404 });
        return NextResponse.json(deepDive);
      }

      case "memory": {
        const memory = await getMemory();
        if (!memory) return NextResponse.json({ error: "No memory yet" }, { status: 404 });
        return NextResponse.json(memory);
      }

      case "summary":
      default: {
        const [osintDate, articleDate, ddDate] = await Promise.all([
          getLatestOsintDate(),
          getLatestDate(),
          getLatestDeepDiveDate(),
        ]);

        const snapshot = osintDate ? await getOsintSnapshot(osintDate) : null;
        const sourceCounts: Record<string, number> = {};
        for (const p of snapshot?.data_points ?? []) {
          sourceCounts[p.source] = (sourceCounts[p.source] ?? 0) + 1;
        }

        return NextResponse.json({
          latest_osint_date: osintDate,
          latest_article_date: articleDate,
          latest_deepdive_date: ddDate,
          osint_data_points: snapshot?.data_points.length ?? 0,
          osint_anomalies: snapshot?.anomalies.length ?? 0,
          sources: sourceCounts,
          usage: "?type=osint&source=fred&country=USA  |  ?type=osint&q=CPI  |  ?type=articles  |  ?type=deepdive  |  ?type=memory",
        });
      }
    }
  } catch (e) {
    console.error("[/api/data]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
