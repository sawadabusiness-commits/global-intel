import { getWeeklyDeepDive, getLatestDeepDiveDate } from "@/lib/kv";
import DeepDiveClient from "./DeepDiveClient";

export const dynamic = "force-dynamic";

export default async function DeepDivePage() {
  const latestDate = await getLatestDeepDiveDate();
  const deepDive = latestDate ? await getWeeklyDeepDive(latestDate) : null;

  return <DeepDiveClient deepDive={deepDive} />;
}
