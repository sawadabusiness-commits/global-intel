import { NextRequest, NextResponse } from "next/server";
import { generateMermaid } from "@/lib/github-models";
import { getArticles, getLatestDate, saveArticles } from "@/lib/kv";

export const maxDuration = 60;

const MAX_ARTICLES = 8;
const INTERVAL_MS = 6000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const latestDate = await getLatestDate();
  if (!latestDate) {
    return NextResponse.json({ ok: true, message: "No articles available" });
  }

  const articles = await getArticles(latestDate);
  if (articles.length === 0) {
    return NextResponse.json({ ok: true, message: "No articles" });
  }

  // impact降順で上位MAX_ARTICLES件、かつ未生成のものに絞る
  const targets = [...articles]
    .filter((a) => !a.mermaid)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, MAX_ARTICLES);

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, date: latestDate, generated: 0, skipped: "all have mermaid" });
  }

  const startTime = Date.now();
  const timeLimit = 54000; // 60s - 6s margin
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  let generated = 0;
  let invalid = 0;

  for (let i = 0; i < targets.length; i++) {
    if (Date.now() - startTime > timeLimit) {
      console.log(`Mermaid time limit reached at ${i}/${targets.length}`);
      break;
    }
    const a = targets[i];
    const code = await generateMermaid({ title_ja: a.title_ja, summary_ja: a.summary_ja });
    if (code) {
      const orig = articleMap.get(a.id);
      if (orig) {
        orig.mermaid = code;
        generated++;
      }
    } else {
      invalid++;
    }
    // 最後の記事の後ろは待たない
    if (i < targets.length - 1) {
      await sleep(INTERVAL_MS);
    }
  }

  if (generated > 0) {
    await saveArticles(latestDate, articles);
  }

  return NextResponse.json({
    ok: true,
    date: latestDate,
    targets: targets.length,
    generated,
    invalid,
    elapsed_ms: Date.now() - startTime,
  });
}
