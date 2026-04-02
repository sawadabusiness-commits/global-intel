import { getArticles, getLatestDate, getOsintVerifications, getOsintArticles, getLatestOsintDate } from "@/lib/kv";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const latestDate = await getLatestDate();
  const today = latestDate ?? new Date().toISOString().split("T")[0];
  const articles = await getArticles(today);
  const verifications = await getOsintVerifications(today);
  const osintDate = await getLatestOsintDate();
  const osintArticles = osintDate ? await getOsintArticles(osintDate) : [];

  return (
    <Dashboard
      articles={articles}
      date={today}
      osintVerifications={verifications}
      osintArticles={osintArticles}
    />
  );
}
