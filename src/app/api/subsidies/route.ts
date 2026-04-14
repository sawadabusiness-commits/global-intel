import { NextRequest, NextResponse } from "next/server";
import { fetchAllSubsidies } from "@/lib/subsidies";
import { fetchAllTaxLaw } from "@/lib/taxlaw";
import { fetchFredBlogPosts } from "@/lib/fredblog";
import { fetchTaxBlogPosts } from "@/lib/taxblog";
import { saveSubsidies, saveTaxLaw, saveFredBlog, saveTaxBlog } from "@/lib/kv";

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
  const yearMonth = today.slice(0, 7); // "2026-04"

  const [subsidies, taxlaw, fredBlogPosts, taxBlogPosts] = await Promise.all([
    fetchAllSubsidies(),
    fetchAllTaxLaw(),
    fetchFredBlogPosts().catch((e) => {
      console.error("FRED Blog fetch failed:", e);
      return [];
    }),
    fetchTaxBlogPosts().catch((e) => {
      console.error("TaxBlog fetch failed:", e);
      return [];
    }),
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
    fredBlogPosts.length > 0 ? saveFredBlog(yearMonth, fredBlogPosts) : Promise.resolve(),
    taxBlogPosts.length > 0 ? saveTaxBlog(yearMonth, taxBlogPosts) : Promise.resolve(),
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
    fredblog: { total: fredBlogPosts.length, month: yearMonth },
    taxblog: { total: taxBlogPosts.length, month: yearMonth },
    elapsed_ms: Date.now() - startTime,
  });
}
