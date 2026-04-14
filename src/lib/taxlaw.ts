import * as cheerio from "cheerio";
import type { TaxLawItem, TaxLawCategory } from "./types";

const UA = "Mozilla/5.0 (compatible; global-intel-dashboard/1.0)";

// --- 国税不服審判所 (KFS) 裁決事例 ---
// 裁決事例集の最新年度インデックスを取得してから、個別案件タイトルを収集

const KFS_INDEX_URL = "https://www.kfs.go.jp/service/MP/02/index.html";
const KFS_BASE = "https://www.kfs.go.jp";

export async function fetchKfsDecisions(): Promise<TaxLawItem[]> {
  try {
    // まずインデックスから最新年度のリンクを取得
    const idxRes = await fetch(KFS_INDEX_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": UA },
    });
    if (!idxRes.ok) return [];
    const idxHtml = await idxRes.text();
    const $idx = cheerio.load(idxHtml);
    const now = new Date().toISOString();

    // 年度別リンク（最新2件程度）を収集
    const yearLinks: string[] = [];
    $idx("a").each((_, el) => {
      const href = $idx(el).attr("href") ?? "";
      const text = $idx(el).text().trim();
      // "令和X年度" or "2024年" などの表記を含むリンク
      if (/(令和|平成)\d+年度?/.test(text) || /\d{4}年/.test(text)) {
        const url = href.startsWith("http") ? href : KFS_BASE + (href.startsWith("/") ? href : "/service/MP/02/" + href);
        if (!yearLinks.includes(url)) yearLinks.push(url);
      }
    });

    // 最新年度のみ取得（最大2件のページ）
    const targets = yearLinks.slice(0, 2);
    if (targets.length === 0) {
      // リンクが見つからない場合はインデックスページ自体からリスト抽出を試みる
      return extractKfsItems($idx, KFS_INDEX_URL, now);
    }

    const allItems: TaxLawItem[] = [];
    for (const targetUrl of targets) {
      const pageRes = await fetch(targetUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": UA },
      });
      if (!pageRes.ok) continue;
      const html = await pageRes.text();
      const $ = cheerio.load(html);
      allItems.push(...extractKfsItems($, targetUrl, now));
    }

    // URLで重複排除
    const seen = new Set<string>();
    return allItems.filter((it) => {
      if (seen.has(it.url)) return false;
      seen.add(it.url);
      return true;
    });
  } catch (e) {
    console.error("KFS fetch failed:", e);
    return [];
  }
}

function extractKfsItems(
  $: ReturnType<typeof cheerio.load>,
  baseUrl: string,
  now: string
): TaxLawItem[] {
  const items: TaxLawItem[] = [];

  $("a").each((_, el) => {
    const $a = $(el);
    const title = $a.text().trim();
    const href = $a.attr("href") ?? "";
    if (!title || !href) return;
    // 個別裁決ページへのリンク（pdfまたはhtmlの裁決番号パターン）
    if (!/\.(pdf|html?)$/i.test(href) && !/\d{4}/.test(href)) return;
    if (title.length < 5) return;

    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = KFS_BASE + href;
    } else {
      const baseDir = baseUrl.replace(/\/[^/]*$/, "/");
      url = new URL(href, baseDir).toString();
    }

    // 日付は title 内か親要素から取得を試みる
    const parentText = $(el).parent().text();
    const dateMatch = parentText.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/);
    const published = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
      : now.slice(0, 10);

    items.push({
      id: `kfs:${url}`,
      source: "kfs",
      category: "裁決事例",
      title,
      url,
      summary: undefined,
      published_at: published,
      fetched_at: now,
    });
  });

  return items.slice(0, 50); // 最大50件
}

// --- 国税庁 (NTA) 通達・質疑応答 ---
// トップページの新着情報 + 通達一覧ページ

const NTA_TOP_URL = "https://www.nta.go.jp/";
const NTA_TSUTATSU_URL = "https://www.nta.go.jp/law/tsutatsu/index.htm";
const NTA_BASE = "https://www.nta.go.jp";

const NTA_CATEGORY_KEYWORDS: { keywords: string[]; category: TaxLawCategory }[] = [
  { keywords: ["通達", "法令解釈通達", "個別通達"], category: "通達" },
  { keywords: ["質疑応答", "Q&A"], category: "質疑応答" },
  { keywords: ["法律", "政令", "省令", "改正", "税制"], category: "法令改正" },
];

function classifyNta(title: string): TaxLawCategory {
  for (const { keywords, category } of NTA_CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => title.includes(kw))) return category;
  }
  return "その他";
}

export async function fetchNtaTaxLaw(): Promise<TaxLawItem[]> {
  const [topItems, tsutatsuItems] = await Promise.all([
    fetchNtaTopPage(),
    fetchNtaTsutatsuList(),
  ]);

  // URL重複排除
  const seen = new Set<string>();
  return [...topItems, ...tsutatsuItems].filter((it) => {
    if (seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });
}

async function fetchNtaTopPage(): Promise<TaxLawItem[]> {
  try {
    const res = await fetch(NTA_TOP_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const now = new Date().toISOString();
    const items: TaxLawItem[] = [];

    // 新着情報セクション内のリンクを収集
    // NTAは .newsList / #whatsnew / .list-new 等のクラスを使うことが多い
    const selectors = [
      ".newsList li",
      "#whatsnew li",
      ".list-new li",
      ".new-info li",
      "ul.new li",
      // 汎用フォールバック
      "li",
    ];

    let found = false;
    for (const sel of selectors) {
      const els = $(sel);
      if (sel === "li" && found) break; // フォールバックは一度だけ

      els.each((_, el) => {
        const $el = $(el);
        const $a = $el.find("a").first();
        const title = $a.text().trim();
        const href = $a.attr("href") ?? "";
        if (!title || !href) return;

        // 通達・法令・質疑応答に関連するものだけ
        const isRelevant = NTA_CATEGORY_KEYWORDS.flatMap((c) => c.keywords).some((kw) => title.includes(kw))
          || ["法人税", "所得税", "消費税", "相続税", "贈与税", "印紙税", "源泉"].some((kw) => title.includes(kw));
        if (!isRelevant) return;

        const url = href.startsWith("http") ? href : NTA_BASE + (href.startsWith("/") ? href : "/" + href);
        const dateText = $el.find("time, .date, span").first().text().trim();
        const dateMatch = dateText.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/);
        const published = dateMatch
          ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
          : now.slice(0, 10);

        items.push({
          id: `nta:${url}`,
          source: "nta",
          category: classifyNta(title),
          title,
          url,
          published_at: published,
          fetched_at: now,
        });
        found = true;
      });

      if (items.length >= 30) break;
    }

    return items;
  } catch (e) {
    console.error("NTA top page fetch failed:", e);
    return [];
  }
}

async function fetchNtaTsutatsuList(): Promise<TaxLawItem[]> {
  try {
    const res = await fetch(NTA_TSUTATSU_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const now = new Date().toISOString();
    const items: TaxLawItem[] = [];

    // 通達一覧の各行
    $("a").each((_, el) => {
      const $a = $(el);
      const title = $a.text().trim();
      const href = $a.attr("href") ?? "";
      if (!title || !href || title.length < 5) return;

      // 税目 or "通達" を含むもの
      const isTsutatsu = ["通達", "法人税", "所得税", "消費税", "相続税", "贈与税", "印紙税", "源泉", "国際"].some(
        (kw) => title.includes(kw)
      );
      if (!isTsutatsu) return;

      const url = href.startsWith("http") ? href : NTA_BASE + (href.startsWith("/") ? href : "/" + href);
      const parentText = $(el).closest("tr, li, div").text();
      const dateMatch = parentText.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/]?(\d{0,2})/);
      const published = dateMatch && dateMatch[3]
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
        : dateMatch
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-01`
        : now.slice(0, 10);

      items.push({
        id: `nta:${url}`,
        source: "nta",
        category: "通達",
        title,
        url,
        published_at: published,
        fetched_at: now,
      });
    });

    // 重複排除して最大50件
    const seen = new Set<string>();
    return items
      .filter((it) => {
        if (seen.has(it.url)) return false;
        seen.add(it.url);
        return true;
      })
      .slice(0, 50);
  } catch (e) {
    console.error("NTA tsutatsu list fetch failed:", e);
    return [];
  }
}

// --- 統合 ---

export async function fetchAllTaxLaw(): Promise<TaxLawItem[]> {
  const [kfs, nta] = await Promise.all([
    fetchKfsDecisions(),
    fetchNtaTaxLaw(),
  ]);

  const seen = new Set<string>();
  return [...kfs, ...nta].filter((it) => {
    if (seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });
}
