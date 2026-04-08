import { getWeeklyDeepDive, getLatestDeepDiveDate, getOsintSnapshot, getLatestOsintDate, getMemory } from "@/lib/kv";
import DeepDiveClient from "./DeepDiveClient";

export const dynamic = "force-dynamic";

export default async function DeepDivePage() {
  const [latestDate, osintDate] = await Promise.all([
    getLatestDeepDiveDate(),
    getLatestOsintDate(),
  ]);
  const [deepDive, osintSnapshot, memory] = await Promise.all([
    latestDate ? getWeeklyDeepDive(latestDate) : Promise.resolve(null),
    osintDate ? getOsintSnapshot(osintDate) : Promise.resolve(null),
    getMemory(),
  ]);

  return <DeepDiveClient deepDive={deepDive} osintData={osintSnapshot?.data_points ?? []} memory={memory} />;
}
