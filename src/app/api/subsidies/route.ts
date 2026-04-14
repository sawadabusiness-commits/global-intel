import { NextRequest, NextResponse } from "next/server";
import { fetchAllSubsidies } from "@/lib/subsidies";
import { saveSubsidies } from "@/lib/kv";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = jst.toISOString().split("T")[0];

  const startTime = Date.now();
  const subsidies = await fetchAllSubsidies();

  // 重複排除（同じURLは1件に）
  const seen = new Set<string>();
  const deduped = subsidies.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  await saveSubsidies(today, deduped);

  // ソース別カウント
  const sourceCounts: Record<string, number> = {};
  for (const s of deduped) {
    sourceCounts[s.source] = (sourceCounts[s.source] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    date: today,
    total: deduped.length,
    sources: sourceCounts,
    elapsed_ms: Date.now() - startTime,
  });
}
