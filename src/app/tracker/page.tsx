import { getAllPredictions } from "@/lib/kv";
import TrackerClient from "./TrackerClient";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const predictions = await getAllPredictions();
  return <TrackerClient predictions={predictions} />;
}
