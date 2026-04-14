import { XMLParser } from "fast-xml-parser";

const TAXBLOG_RSS = "https://willow8-tax.com/feed/";
const GITHUB_MODELS_URL = "https://models.inference.ai.azure.com/chat/completions";

export interface TaxBlogPost {
  id: string;
  title: string;
  url: string;
  pubDate: string;       // ISO日付
  author: string;
  category: string;
  contentHtml: string;   // content:encoded の全HTML（そのまま表示）
  excerpt: string;       // プレーンテキスト抜粋（AI入力用）
  juniorExplanation: string; // 中学生向け解説
  fetched_at: string;
}

/** HTML タグ除去 + エンティティ変換 */
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

/** CDATA または文字列を取り出す */
function extractCdata(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.__cdata === "string") return obj.__cdata;
  }
  return "";
}

interface RawItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
  "dc:creator"?: unknown;
  category?: unknown;
  description?: unknown;
  "content:encoded"?: unknown;
}

/** RSSから最新5件を取得 */
async function fetchRawPosts(): Promise<RawItem[]> {
  const res = await fetch(TAXBLOG_RSS, {
    headers: { "User-Agent": "global-intel-bot/1.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`TaxBlog RSS fetch failed: ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    cdataPropName: "__cdata",
    parseTagValue: true,
  });
  const doc = parser.parse(xml);
  const items: RawItem[] = doc?.rss?.channel?.item ?? [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.slice(0, 5);
}

/** gpt-4o-mini で中学生向け解説を一括生成 */
async function generateJuniorExplanations(
  posts: Array<{ title: string; excerpt: string }>
): Promise<string[]> {
  const input = posts
    .map(
      (p, i) =>
        `[${i}]\nタイトル: ${p.title}\n本文: ${p.excerpt.slice(0, 600)}`
    )
    .join("\n\n---\n\n");

  const systemPrompt =
    "あなたは税務の専門家で、難しい税務判決や税法の解説を中学生にも分かりやすく伝えるのが得意です。" +
    "以下の各記事について、中学生でも理解できる言葉で3〜4文の解説を書いてください。" +
    "専門用語は使わず、具体例や身近な例えを使ってください。" +
    "JSON配列で返してください: [\"解説1\", \"解説2\", ...]" +
    "余計なコメントは不要です。";

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
      max_tokens: 1500,
      temperature: 0.5,
    }),
  });

  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`No JSON array in response: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]) as string[];
}

/** 柳谷税理士ブログの最新5件を取得・解説生成して返す */
export async function fetchTaxBlogPosts(): Promise<TaxBlogPost[]> {
  const rawItems = await fetchRawPosts();
  const fetched_at = new Date().toISOString();

  const posts = rawItems.map((item) => {
    const url = String(extractCdata(item.link) || item.link || "").trim();
    const contentHtml = extractCdata(item["content:encoded"]);
    const descHtml = extractCdata(item.description);
    const excerpt = stripHtml(contentHtml || descHtml).slice(0, 800);

    const rawPub = String(extractCdata(item.pubDate) || item.pubDate || "");
    let pubDate = "";
    try {
      pubDate = new Date(rawPub).toISOString().split("T")[0];
    } catch {
      pubDate = rawPub.slice(0, 10);
    }

    // カテゴリ（複数の場合は配列になる）
    const catRaw = item.category;
    const category = Array.isArray(catRaw)
      ? catRaw.map((c: unknown) => extractCdata(c) || String(c)).join(" / ")
      : extractCdata(catRaw) || String(catRaw ?? "");

    // id: URL末尾の数字 or スラグ
    const idMatch = url.match(/\/(\d+)\/?$/);
    const id = idMatch ? idMatch[1] : url.slice(-20);

    return {
      id,
      title: String(extractCdata(item.title) || item.title || "").trim(),
      url,
      pubDate,
      author: String(extractCdata(item["dc:creator"]) || "柳谷憲司").trim(),
      category,
      contentHtml,
      excerpt,
      juniorExplanation: "",
      fetched_at,
    };
  });

  // 中学生向け解説を一括生成
  let explanations: string[] = [];
  try {
    explanations = await generateJuniorExplanations(
      posts.map((p) => ({ title: p.title, excerpt: p.excerpt }))
    );
  } catch (e) {
    console.error("TaxBlog junior explanation failed:", e);
    explanations = posts.map(() => "（解説の生成に失敗しました）");
  }

  return posts.map((p, i) => ({
    ...p,
    juniorExplanation: explanations[i] ?? "（解説なし）",
  }));
}
