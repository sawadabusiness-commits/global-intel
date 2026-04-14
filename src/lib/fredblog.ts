import { XMLParser } from "fast-xml-parser";

const FRED_BLOG_RSS = "https://fredblog.stlouisfed.org/feed/";
const GITHUB_MODELS_URL = "https://models.inference.ai.azure.com/chat/completions";

export interface FredBlogPost {
  id: string;         // URLスラグ由来
  title: string;      // 英語原文
  title_ja: string;   // 日本語訳
  url: string;
  pubDate: string;    // ISO日付文字列
  author: string;
  excerpt: string;    // 英語抜粋
  excerpt_ja: string; // 日本語訳
  imageUrls: string[]; // チャート画像URL
  fetched_at: string;
}

/** content:encoded の HTML から img src を抽出 */
function extractImages(html: string): string[] {
  const urls: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(html)) !== null) {
    const src = m[1];
    // 小アイコン・絵文字・1x1トラッキングピクセルを除外
    if (src.includes("emoji") || src.includes("s.w.org") || src.includes("pixel")) continue;
    urls.push(src);
  }
  return [...new Set(urls)]; // 重複除外
}

/** HTML タグ除去 + 連続スペース整理 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** URLスラグからIDを生成 */
function slugToId(url: string): string {
  const m = url.match(/\/(\d{4}\/\d{2}\/[^/]+)\/?$/);
  return m ? m[1].replace(/\//g, "-") : url.slice(-40);
}

interface RawItem {
  title?: string;
  link?: string;
  pubDate?: string;
  "dc:creator"?: string;
  description?: string;
  "content:encoded"?: string;
}

/** FRED Blog RSSフィードを取得・パース（最新5件） */
async function fetchRawPosts(): Promise<RawItem[]> {
  const res = await fetch(FRED_BLOG_RSS, {
    headers: { "User-Agent": "global-intel-bot/1.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`FRED Blog RSS fetch failed: ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    cdataPropName: "__cdata",
    parseTagValue: true,
  });
  const doc = parser.parse(xml);
  const items: RawItem[] = doc?.rss?.channel?.item ?? [];
  return Array.isArray(items) ? items.slice(0, 5) : [items].slice(0, 5);
}

/** GitHub Models (gpt-4o-mini) でタイトルと抜粋を一括和訳 */
async function translatePosts(
  posts: Array<{ title: string; excerpt: string }>
): Promise<Array<{ title_ja: string; excerpt_ja: string }>> {
  const input = posts
    .map(
      (p, i) =>
        `[${i}]\nTITLE: ${p.title}\nEXCERPT: ${p.excerpt.slice(0, 400)}`
    )
    .join("\n\n---\n\n");

  const systemPrompt =
    "You are a professional Japanese translator specializing in economics and finance. " +
    "Translate the given FRED Blog post titles and excerpts into natural Japanese. " +
    "Return a JSON array in the exact order given: " +
    '[{"title_ja":"...","excerpt_ja":"..."}, ...]. ' +
    "Do not add extra commentary. excerpt_ja should be under 200 characters.";

  const res = await fetch(GITHUB_MODELS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`Translation API error: ${res.status}`);
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "[]";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`No JSON in translation response: ${text.slice(0, 200)}`);

  const parsed = JSON.parse(jsonMatch[0]) as Array<{ title_ja: string; excerpt_ja: string }>;
  return parsed;
}

/** FRED Blog 最新5件を取得・和訳して返す */
export async function fetchFredBlogPosts(): Promise<FredBlogPost[]> {
  const rawItems = await fetchRawPosts();
  const fetched_at = new Date().toISOString();

  // まず構造化（和訳前）
  const posts = rawItems.map((item) => {
    const url = (typeof item.link === "string" ? item.link : "").trim();
    const rawContent =
      (typeof item["content:encoded"] === "object" &&
        (item["content:encoded"] as { __cdata?: string }).__cdata) ||
      (typeof item["content:encoded"] === "string" ? item["content:encoded"] : "") ||
      "";
    const rawDesc =
      (typeof item.description === "object" &&
        (item.description as { __cdata?: string }).__cdata) ||
      (typeof item.description === "string" ? item.description : "") ||
      "";

    const title = String(item.title ?? "").trim();
    const excerpt = stripHtml(rawDesc || rawContent).slice(0, 500);
    const imageUrls = extractImages(rawContent || rawDesc);

    // pubDate を ISO に変換
    const raw = String(item.pubDate ?? "");
    let pubDate = "";
    try {
      pubDate = new Date(raw).toISOString().split("T")[0];
    } catch {
      pubDate = raw.slice(0, 10);
    }

    return {
      id: slugToId(url),
      title,
      url,
      pubDate,
      author: String(item["dc:creator"] ?? "FRED Blog").trim(),
      excerpt,
      imageUrls,
      fetched_at,
    };
  });

  // 一括和訳
  let translations: Array<{ title_ja: string; excerpt_ja: string }> = [];
  try {
    translations = await translatePosts(posts.map((p) => ({ title: p.title, excerpt: p.excerpt })));
  } catch (e) {
    console.error("FRED Blog translation failed:", e);
    // 翻訳失敗時は英語原文をフォールバック
    translations = posts.map((p) => ({ title_ja: p.title, excerpt_ja: p.excerpt.slice(0, 200) }));
  }

  return posts.map((p, i) => ({
    ...p,
    title_ja: translations[i]?.title_ja ?? p.title,
    excerpt_ja: translations[i]?.excerpt_ja ?? p.excerpt.slice(0, 200),
  }));
}
