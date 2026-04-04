import { getWeeklyDeepDive, getLatestDeepDiveDate, getOsintSnapshot, getLatestOsintDate } from "@/lib/kv";
import DeepDiveClient from "./DeepDiveClient";

export const dynamic = "force-dynamic";

export default async function DeepDivePage() {
  const latestDate = await getLatestDeepDiveDate();
  const deepDive = latestDate ? await getWeeklyDeepDive(latestDate) : null;

  const osintDate = await getLatestOsintDate();
  const osintSnapshot = osintDate ? await getOsintSnapshot(osintDate) : null;

  return <DeepDiveClient deepDive={deepDive} osintData={osintSnapshot?.data_points ?? []} />;
}
