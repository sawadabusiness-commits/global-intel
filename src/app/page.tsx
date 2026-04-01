import { getArticles, getLatestDate } from "@/lib/kv";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const latestDate = await getLatestDate();
  const today = latestDate ?? new Date().toISOString().split("T")[0];
  const articles = await getArticles(today);

  return <Dashboard articles={articles} date={today} />;
}
