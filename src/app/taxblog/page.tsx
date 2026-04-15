import { getTaxBlog, getLatestTaxBlogDate } from "@/lib/kv";
import type { TaxBlogPost } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

function TaxBlogCard({ post }: { post: TaxBlogPost }) {
  return (
    <article className="rounded-lg bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      {/* ヘッダー */}
      <div className="p-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#6366F120] text-[#6366F1]">
            {post.category || "税務"}
          </span>
          <span className="text-[10px] font-mono text-[var(--muted)]">{post.pubDate}</span>
          <span className="text-[10px] font-mono text-[var(--muted)]">{post.author}</span>
        </div>
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-base font-semibold hover:text-[#38BDF8] transition-colors"
        >
          {post.title}
        </a>
      </div>

      {/* 中学生向け解説 */}
      <div className="mx-5 mt-4 p-4 rounded-lg border border-[#10B98140] bg-[#10B98108]">
        <p className="text-[10px] font-mono text-[#10B981] mb-2 uppercase tracking-wider">
          ざっくり言うと（中学生向け解説）
        </p>
        <p className="text-sm text-[#CBD5E1] leading-relaxed">{post.juniorExplanation}</p>
      </div>

      {/* 本文HTML（原文そのまま） */}
      <div
        className="p-5 taxblog-content"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />

      <div className="px-5 pb-5">
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#38BDF8] hover:underline"
        >
          元記事を読む →
        </a>
      </div>
    </article>
  );
}

export default async function TaxBlogPage() {
  const month = await getLatestTaxBlogDate();
  const posts: TaxBlogPost[] = month ? await getTaxBlog(month) : [];

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[#E2E8F0] p-6">
      <style>{`
        .taxblog-content h2 {
          font-size: 1rem;
          font-weight: 700;
          margin: 1.25rem 0 0.5rem;
          padding-bottom: 0.25rem;
          border-bottom: 1px solid var(--border);
          color: #E2E8F0;
        }
        .taxblog-content h3 {
          font-size: 0.875rem;
          font-weight: 600;
          margin: 1rem 0 0.375rem;
          color: #CBD5E1;
        }
        .taxblog-content p {
          font-size: 0.875rem;
          line-height: 1.75;
          margin: 0.5rem 0;
          color: #CBD5E1;
        }
        .taxblog-content strong {
          color: #E2E8F0;
          font-weight: 600;
        }
        .taxblog-content a {
          color: #38BDF8;
          text-decoration: underline;
        }
        .taxblog-content a:hover {
          opacity: 0.8;
        }
        .taxblog-content ul, .taxblog-content ol {
          margin: 0.5rem 0 0.5rem 1.5rem;
          font-size: 0.875rem;
          color: #CBD5E1;
        }
        .taxblog-content li {
          margin: 0.25rem 0;
        }
        .taxblog-content blockquote {
          border-left: 3px solid var(--border);
          padding-left: 1rem;
          margin: 0.75rem 0;
          color: #94A3B8;
          font-size: 0.8125rem;
        }
      `}</style>

      <div className="max-w-3xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">税務判例記事</h1>
            <p className="text-xs text-[var(--muted)] mt-1">
              個人の税務調査・審理・国際課税に特化
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
          <div className="space-y-8">
            {posts.map((post) => (
              <TaxBlogCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
