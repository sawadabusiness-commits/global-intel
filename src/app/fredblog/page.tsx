import { getFredBlog, getLatestFredBlogDate } from "@/lib/kv";
import type { FredBlogPost } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

function FredBlogCard({ post }: { post: FredBlogPost }) {
  return (
    <article className="rounded-lg bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
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
          className="block text-base font-semibold hover:text-[#38BDF8] transition-colors mb-1"
        >
          {post.title_ja}
        </a>
        <p className="text-[11px] text-[var(--muted)] italic mb-3">{post.title}</p>
        <p className="text-sm text-[#CBD5E1] leading-relaxed">{post.excerpt_ja}</p>
      </div>

      {post.imageUrls.length > 0 && (
        <div className="px-5 pb-5 space-y-4">
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

      <div className="px-5 pb-4">
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#38BDF8] hover:underline"
        >
          原文を読む →
        </a>
      </div>
    </article>
  );
}

export default async function FredBlogPage() {
  const month = await getLatestFredBlogDate();
  const posts: FredBlogPost[] = month ? await getFredBlog(month) : [];

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[#E2E8F0] p-6">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">FRED Blog</h1>
            <p className="text-xs text-[var(--muted)] mt-1">
              米セントルイス連邦準備銀行 — 経済分析レポート
              {month && <span className="ml-2">（{month} 取得 / {posts.length}件）</span>}
            </p>
          </div>
          <Link href="/" className="text-xs text-[#38BDF8] hover:underline">
            ← ダッシュボードへ
          </Link>
        </header>

        {posts.length === 0 ? (
          <div className="py-16 text-center text-[var(--muted)]">
            <p>まだデータが取得されていません。</p>
            <p className="text-xs mt-2">
              Cron実行後（毎日22:00 UTC）に自動取得されます。
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <FredBlogCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
