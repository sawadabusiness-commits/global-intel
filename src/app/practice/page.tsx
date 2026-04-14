import { getSubsidies, getLatestSubsidiesDate } from "@/lib/kv";
import type { Subsidy, IndustryTag } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

const INDUSTRY_LABELS: Record<IndustryTag, string> = {
  medical: "医療",
  welfare: "福祉",
  construction: "建設",
  food_manufacturing: "食品製造",
  retail: "小売",
  general: "全般",
};

const INDUSTRY_ORDER: IndustryTag[] = ["medical", "welfare", "construction", "food_manufacturing", "retail", "general"];

function formatAmount(n: number | null | undefined): string {
  if (!n) return "";
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億円`;
  if (n >= 10000) return `${(n / 10000).toLocaleString()}万円`;
  return `${n.toLocaleString()}円`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default async function PracticePage() {
  const date = await getLatestSubsidiesDate();
  const subsidies: Subsidy[] = date ? await getSubsidies(date) : [];

  const byIndustry = new Map<IndustryTag, Subsidy[]>();
  for (const s of subsidies) {
    for (const tag of s.industry_tags) {
      const list = byIndustry.get(tag) ?? [];
      list.push(s);
      byIndustry.set(tag, list);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[#E2E8F0] p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">実務情報: 補助金・助成金</h1>
            <p className="text-xs text-[var(--muted)] mt-1">
              取得日: {date ?? "未取得"} / 全{subsidies.length}件
              （ソース: jGrants, 厚労省RSS）
            </p>
          </div>
          <Link href="/" className="text-xs text-[#38BDF8] hover:underline">
            ← ダッシュボードへ
          </Link>
        </header>

        {subsidies.length === 0 && (
          <div className="py-12 text-center text-[var(--muted)]">
            <p>まだ補助金データが取得されていません。</p>
            <p className="text-xs mt-2">Cron実行後（毎日7:00 UTC）に表示されます。</p>
          </div>
        )}

        {INDUSTRY_ORDER.map((tag) => {
          const list = byIndustry.get(tag);
          if (!list || list.length === 0) return null;
          return (
            <section key={tag} className="mb-8">
              <h2 className="text-sm font-bold mb-3 pb-2 border-b border-[var(--border)]">
                {INDUSTRY_LABELS[tag]}（{list.length}件）
              </h2>
              <div className="space-y-2">
                {list.map((s) => (
                  <article
                    key={s.id}
                    className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]"
                  >
                    <div className="flex items-start gap-2 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-mono"
                        style={{
                          background: s.source === "jgrants" ? "#6366F120" : "#10B98120",
                          color: s.source === "jgrants" ? "#6366F1" : "#10B981",
                        }}
                      >
                        {s.source === "jgrants" ? "jGrants" : "厚労省"}
                      </span>
                      {s.target_area.slice(0, 3).map((a) => (
                        <span
                          key={a}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--surface-2)] text-[var(--muted)]"
                        >
                          {a}
                        </span>
                      ))}
                      {s.amount_max && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#F59E0B20] text-[#F59E0B]">
                          上限 {formatAmount(s.amount_max)}
                        </span>
                      )}
                      {s.deadline && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#EF444420] text-[#EF4444]">
                          締切 {formatDate(s.deadline)}
                        </span>
                      )}
                    </div>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-2 text-sm hover:text-[#38BDF8] transition-colors"
                    >
                      {s.title}
                    </a>
                    {s.summary && (
                      <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">
                        {s.summary}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
