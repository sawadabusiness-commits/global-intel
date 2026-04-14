import { NextRequest, NextResponse } from "next/server";
import { fetchAllSubsidies } from "@/lib/subsidies";
import { fetchAllTaxLaw } from "@/lib/taxlaw";
import { saveSubsidies, saveTaxLaw } from "@/lib/kv";

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
  const [subsidies, taxlaw] = await Promise.all([
    fetchAllSubsidies(),
    fetchAllTaxLaw(),
  ]);

  // 補助金 重複排除
  const seenS = new Set<string>();
  const deduped = subsidies.filter((s) => {
    if (seenS.has(s.url)) return false;
    seenS.add(s.url);
    return true;
  });

  // 税務情報 重複排除
  const seenT = new Set<string>();
  const dedupedTax = taxlaw.filter((t) => {
    if (seenT.has(t.url)) return false;
    seenT.add(t.url);
    return true;
  });

  await Promise.all([
    saveSubsidies(today, deduped),
    saveTaxLaw(today, dedupedTax),
  ]);

  // ソース別カウント
  const sourceCounts: Record<string, number> = {};
  for (const s of deduped) {
    sourceCounts[s.source] = (sourceCounts[s.source] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    date: today,
    subsidies: { total: deduped.length, sources: sourceCounts },
    taxlaw: { total: dedupedTax.length },
    elapsed_ms: Date.now() - startTime,
  });
}
