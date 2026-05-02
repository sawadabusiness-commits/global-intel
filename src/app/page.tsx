import { getArticles, getLatestDate, getOsintVerifications, getOsintArticles, getLatestOsintDate, getOsintSnapshot, getMemory, getHeadline, getClusters } from "@/lib/kv";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const latestDate = await getLatestDate();
  const today = latestDate ?? new Date().toISOString().split("T")[0];
  const [articles, verifications, osintDate, headline, clusters] = await Promise.all([
    getArticles(today),
    getOsintVerifications(today),
    getLatestOsintDate(),
    getHeadline(today),
    getClusters(today),
  ]);
  const [osintArticles, osintSnapshot, memory] = await Promise.all([
    osintDate ? getOsintArticles(osintDate) : Promise.resolve([]),
    osintDate ? getOsintSnapshot(osintDate) : Promise.resolve(null),
    getMemory(),
  ]);

  return (
    <Dashboard
      articles={articles}
      date={today}
      headline={headline}
      clusters={clusters}
      osintVerifications={verifications}
      osintArticles={osintArticles}
      anomalies={osintSnapshot?.anomalies ?? []}
      memory={memory}
    />
  );
}
