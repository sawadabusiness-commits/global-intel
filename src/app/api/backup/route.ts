import { NextRequest, NextResponse } from "next/server";
import { getAllPredictions, getLatestDeepDiveDate, getWeeklyDeepDive } from "@/lib/kv";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const predictions = await getAllPredictions();

  const latestDDDate = await getLatestDeepDiveDate();
  let latestDeepDive = null;
  if (latestDDDate) {
    latestDeepDive = await getWeeklyDeepDive(latestDDDate);
  }

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    predictions,
    latest_deep_dive: latestDeepDive,
  });
}
