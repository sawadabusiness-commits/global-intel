import { getSubsidies, getLatestSubsidiesDate, getTaxLaw, getLatestTaxLawDate, getFredBlog, getLatestFredBlogDate } from "@/lib/kv";
import type { Subsidy, IndustryTag, TaxLawItem, TaxLawCategory, FredBlogPost } from "@/lib/types";
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

const REGION_ORDER = ["広島県", "広島市", "廿日市市", "兵庫県", "宍粟市", "全国"];

// 市は属する県の補助金も利用可能（県補助金は市内事業者に適用されるため）
const REGION_MATCH_KEYS: Record<string, string[]> = {
  "全国": ["全国"],
  "広島県": ["広島県"],
  "広島市": ["広島県", "広島市"],
  "廿日市市": ["広島県", "廿日市市"],
  "兵庫県": ["兵庫県"],
  "宍粟市": ["兵庫県", "宍粟市"],
};

function matchRegion(subsidy: Subsidy, region: string): boolean {
  const keys = REGION_MATCH_KEYS[region] ?? [region];
  return subsidy.target_area.some((a) => keys.some((k) => a.includes(k)));
}

const TAX_CATEGORY_COLOR: Record<TaxLawCategory, { bg: string; text: string }> = {
  "裁決事例": { bg: "#EF444420", text: "#EF4444" },
  "通達":     { bg: "#F59E0B20", text: "#F59E0B" },
  "質疑応答": { bg: "#6366F120", text: "#6366F1" },
  "法令改正": { bg: "#10B98120", text: "#10B981" },
  "その他":   { bg: "#64748B20", text: "#94A3B8" },
};

function FredBlogCard({ post }: { post: FredBlogPost }) {
  return (
    <article className="rounded-lg bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#10B98120] text-[#10B981]">
            FRED Blog
          </span>
          <span className="text-[10px] font-mono text-[var(--muted)]">{post.pubDate}</span>
          <span className="text-[10px] font-mono text-[var(--muted)]">{post.author}</span>
        </div>
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm font-semibold hover:text-[#38BDF8] transition-colors mb-1"
        >
          {post.title_ja}
        </a>
        <p className="text-[10px] text-[var(--muted)] italic mb-2">{post.title}</p>
        <p className="text-xs text-[var(--muted)] leading-relaxed">{post.excerpt_ja}</p>
      </div>
      {post.imageUrls.length > 0 && (
        <div className="px-4 pb-4 space-y-3">
          {post.imageUrls.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`Chart ${i + 1}`}
              className="w-full rounded border border-[var(--border)]"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ))}
        </div>
      )}
    </article>
  );
}

function TaxLawCard({ t }: { t: TaxLawItem }) {
  const col = TAX_CATEGORY_COLOR[t.category];
  return (
    <article className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
      <div className="flex items-start gap-2 flex-wrap">
        <span
          className="px-2 py-0.5 rounded text-[10px] font-mono"
          style={{ background: col.bg, color: col.text }}
        >
          {t.category}
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--surface-2)] text-[var(--muted)]">
          {t.source === "kfs" ? "国税不服審判所" : "国税庁"}
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--surface-2)] text-[var(--muted)]">
          {t.published_at}
        </span>
      </div>
      <a
        href={t.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-2 text-sm hover:text-[#38BDF8] transition-colors"
      >
        {t.title}
      </a>
      {t.summary && (
        <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{t.summary}</p>
      )}
    </article>
  );
}

function SubsidyCard({ s }: { s: Subsidy }) {
  return (
    <article className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
      <div className="flex items-start gap-2 flex-wrap">
        <span
          className="px-2 py-0.5 rounded text-[10px] font-mono"
          style={{
            background:
              s.source === "jgrants" ? "#6366F120" :
              s.source === "j-net21" ? "#8B5CF620" :
              s.source === "meti" ? "#F9731620" :
              s.source === "chusho" ? "#EC489920" :
              "#10B98120",
            color:
              s.source === "jgrants" ? "#6366F1" :
              s.source === "j-net21" ? "#8B5CF6" :
              s.source === "meti" ? "#F97316" :
              s.source === "chusho" ? "#EC4899" :
              "#10B981",
          }}
        >
          {s.source === "jgrants" ? "jGrants" : s.source === "mhlw" ? "厚労省" : s.source === "j-net21" ? "J-Net21" : s.source === "meti" ? "経産省" : s.source === "chusho" ? "中企庁" : s.source === "city-hatsukaichi" ? "廿日市市" : s.source === "city-shiso" ? "宍粟市" : "広島市"}
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
  );
}

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

const TAX_CATEGORY_ORDER: TaxLawCategory[] = ["裁決事例", "通達", "質疑応答", "法令改正", "その他"];

export default async function PracticePage() {
  const [date, taxDate, fredMonth] = await Promise.all([
    getLatestSubsidiesDate(),
    getLatestTaxLawDate(),
    getLatestFredBlogDate(),
  ]);
  const [subsidies, taxlaw, fredPosts]: [Subsidy[], TaxLawItem[], FredBlogPost[]] = await Promise.all([
    date ? getSubsidies(date) : Promise.resolve([]),
    taxDate ? getTaxLaw(taxDate) : Promise.resolve([]),
    fredMonth ? getFredBlog(fredMonth) : Promise.resolve([]),
  ]);

  // 税務情報 カテゴリ別
  const byTaxCategory = new Map<TaxLawCategory, TaxLawItem[]>();
  for (const t of taxlaw) {
    const list = byTaxCategory.get(t.category) ?? [];
    list.push(t);
    byTaxCategory.set(t.category, list);
  }

  // 中企庁は専用セクション、それ以外を地域別・業種別に
  const chushoItems = subsidies.filter((s) => s.source === "chusho");
  const otherSubsidies = subsidies.filter((s) => s.source !== "chusho");

  const byIndustry = new Map<IndustryTag, Subsidy[]>();
  for (const s of otherSubsidies) {
    for (const tag of s.industry_tags) {
      const list = byIndustry.get(tag) ?? [];
      list.push(s);
      byIndustry.set(tag, list);
    }
  }

  const byRegion = new Map<string, Subsidy[]>();
  for (const region of REGION_ORDER) {
    const matched = otherSubsidies.filter((s) => matchRegion(s, region));
    if (matched.length > 0) byRegion.set(region, matched);
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[#E2E8F0] p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">実務情報: 補助金・助成金</h1>
            <p className="text-xs text-[var(--muted)] mt-1">
              補助金: {date ?? "未取得"} / {subsidies.length}件 ／
              税務情報: {taxDate ?? "未取得"} / {taxlaw.length}件 ／
              FREDブログ: {fredMonth ?? "未取得"} / {fredPosts.length}件
            </p>
          </div>
          <Link href="/" className="text-xs text-[#38BDF8] hover:underline">
            ← ダッシュボードへ
          </Link>
        </header>

        {subsidies.length === 0 && taxlaw.length === 0 && chushoItems.length === 0 && fredPosts.length === 0 && (
          <div className="py-12 text-center text-[var(--muted)]">
            <p>まだデータが取得されていません。</p>
            <p className="text-xs mt-2">Cron実行後（毎日22:00 UTC）に表示されます。</p>
          </div>
        )}

        {/* FRED Blog */}
        {fredPosts.length > 0 && (
          <>
            <h2 className="text-lg font-bold mb-4 text-[#10B981]">
              FRED Blog — 米連邦準備銀行 経済分析
            </h2>
            <section className="mb-10 space-y-4">
              {fredPosts.map((post) => (
                <FredBlogCard key={post.id} post={post} />
              ))}
            </section>
          </>
        )}

        {/* 税務情報 */}
        {taxlaw.length > 0 && (
          <>
            <h2 className="text-lg font-bold mb-4 text-[#F59E0B]">税務情報</h2>
            {TAX_CATEGORY_ORDER.map((cat) => {
              const list = byTaxCategory.get(cat);
              if (!list || list.length === 0) return null;
              return (
                <section key={cat} className="mb-8">
                  <h3 className="text-sm font-bold mb-3 pb-2 border-b border-[var(--border)]">
                    {cat}（{list.length}件）
                  </h3>
                  <div className="space-y-2">
                    {list.map((t) => (
                      <TaxLawCard key={t.id} t={t} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}

        {/* 中企庁 */}
        {chushoItems.length > 0 && (
          <>
            <h2 className="text-lg font-bold mb-4 mt-10 text-[#EC4899]">中小企業庁 / 事業承継・M&A・補助金公募</h2>
            <section className="mb-8">
              <div className="space-y-2">
                {chushoItems.map((s) => (
                  <SubsidyCard key={s.id} s={s} />
                ))}
              </div>
            </section>
          </>
        )}

        {/* 補助金・助成金 */}
        {byRegion.size > 0 && (
          <h2 className="text-lg font-bold mb-4 mt-10 text-[#38BDF8]">補助金・助成金（地域別）</h2>
        )}

        {REGION_ORDER.map((region) => {
          const list = byRegion.get(region);
          if (!list || list.length === 0) return null;
          return (
            <section key={region} className="mb-8">
              <h2 className="text-sm font-bold mb-3 pb-2 border-b border-[var(--border)]">
                {region}（{list.length}件）
              </h2>
              <div className="space-y-2">
                {list.map((s) => (
                  <SubsidyCard key={`${region}-${s.id}`} s={s} />
                ))}
              </div>
            </section>
          );
        })}

        {subsidies.length > 0 && (
          <h2 className="text-lg font-bold mb-4 mt-10 text-[#38BDF8]">補助金・助成金（業種別）</h2>
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
                  <SubsidyCard key={s.id} s={s} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
