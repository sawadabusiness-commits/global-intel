import * as cheerio from "cheerio";
import type { Subsidy } from "./types";
import { tagIndustries, shouldExclude } from "./subsidies";

const UA = "Mozilla/5.0 (compatible; global-intel-dashboard/1.0)";

const CITY_KEYWORDS = ["補助金", "助成金", "給付金", "支援金", "奨励金", "利子補給", "交付金"];

function containsKeyword(text: string): boolean {
  return CITY_KEYWORDS.some((kw) => text.includes(kw));
}

// --- 廿日市市 ---

const HATSUKAICHI_BUSINESS_URL = "https://www.city.hatsukaichi.hiroshima.jp/life/2/18/";
const HATSUKAICHI_BASE = "https://www.city.hatsukaichi.hiroshima.jp";

export async function fetchHatsukaichiSubsidies(): Promise<Subsidy[]> {
  try {
    const res = await fetch(HATSUKAICHI_BUSINESS_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const now = new Date().toISOString();
    const items: Subsidy[] = [];

    $("li").each((_, el) => {
      const $li = $(el);
      const dateText = $li.find("span.span_a").first().text().trim();
      const $a = $li.find("span.article_title a").first();
      const title = $a.text().trim();
      const href = $a.attr("href") ?? "";
      if (!title || !href) return;
      if (!containsKeyword(title)) return;
      if (shouldExclude(title)) return;

      const m = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      const published = m
        ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
        : now.slice(0, 10);
      const url = href.startsWith("http") ? href : HATSUKAICHI_BASE + href;

      items.push({
        id: `hatsukaichi:${url}`,
        source: "city-hatsukaichi",
        title,
        url,
        summary: undefined,
        published_at: published,
        deadline: null,
        target_area: ["廿日市市"],
        industry_tags: tagIndustries(title),
        amount_max: null,
        fetched_at: now,
      });
    });

    // URL重複排除
    const seen = new Set<string>();
    return items.filter((it) => {
      if (seen.has(it.url)) return false;
      seen.add(it.url);
      return true;
    });
  } catch (e) {
    console.error("Hatsukaichi fetch failed:", e);
    return [];
  }
}

// --- 宍粟市（SMART CMS tree.json API） ---

const SHISO_TREE_URL = "https://www.city.shiso.lg.jp/jigyosha/yushiseido/index.tree.json";

interface ShisoPage {
  page_no: number;
  page_name: string;
  url: string;
  publish_datetime?: string;
  description?: string;
  keyword?: string;
  child_pages?: ShisoPage[];
}

function flattenShisoPages(pages: ShisoPage[]): ShisoPage[] {
  const result: ShisoPage[] = [];
  for (const p of pages) {
    result.push(p);
    if (p.child_pages && p.child_pages.length > 0) {
      result.push(...flattenShisoPages(p.child_pages));
    }
  }
  return result;
}

export async function fetchShisoSubsidies(): Promise<Subsidy[]> {
  try {
    const res = await fetch(SHISO_TREE_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const data: ShisoPage[] = await res.json();
    const flat = flattenShisoPages(data);
    const now = new Date().toISOString();

    const items: Subsidy[] = [];
    for (const p of flat) {
      const text = `${p.page_name} ${p.description ?? ""} ${p.keyword ?? ""}`;
      if (!containsKeyword(text)) continue;
      if (shouldExclude(p.page_name, p.description)) continue;

      items.push({
        id: `shiso:${p.page_no}`,
        source: "city-shiso",
        title: p.page_name,
        url: p.url,
        summary: p.description || undefined,
        published_at: p.publish_datetime?.slice(0, 10) ?? now.slice(0, 10),
        deadline: null,
        target_area: ["宍粟市"],
        industry_tags: tagIndustries(text),
        amount_max: null,
        fetched_at: now,
      });
    }
    return items;
  } catch (e) {
    console.error("Shiso fetch failed:", e);
    return [];
  }
}

// --- 広島市 ---

const HIROSHIMA_BASE = "https://www.city.hiroshima.lg.jp";
const HIROSHIMA_CATEGORY_URLS = [
  "/business/sangyo/1021490/index.html",            // 中小企業支援
  "/business/sangyo/1021490/1026451/index.html",    // 経営支援・創業支援
  "/business/sangyo/1021490/1005979/index.html",    // 融資制度
  "/business/sangyo/1021490/1024252/index.html",    // 企業支援
  "/business/sangyo/1021492/index.html",            // 企業誘致・創業推進
  "/business/sangyo/1021492/1038804/index.html",    // 創業支援
  "/business/sangyo/1021490/1026494/1026495/index.html", // 商店街振興
  "/business/koyo_rodo/1021504/index.html",         // 雇用・労働
];
const HIROSHIMA_RSS = "https://www.city.hiroshima.lg.jp/news.rss";

function resolveHiroshimaUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return HIROSHIMA_BASE + href;
  // 相対パス ../../ を解決
  const baseDir = baseUrl.replace(/\/[^\/]*$/, "/");
  const url = new URL(href, baseDir);
  return url.toString();
}

async function fetchHiroshimaCategory(path: string): Promise<Subsidy[]> {
  const url = HIROSHIMA_BASE + path;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const now = new Date().toISOString();
  const items: Subsidy[] = [];

  $("a").each((_, el) => {
    const $a = $(el);
    const title = $a.text().trim();
    const href = $a.attr("href") ?? "";
    if (!title || !href) return;
    if (!/\d{7}\.html$/.test(href)) return; // 記事URL（7桁数字）のみ
    if (!containsKeyword(title)) return;
    if (shouldExclude(title)) return;

    const resolvedUrl = resolveHiroshimaUrl(href, url);
    items.push({
      id: `hiroshima:${resolvedUrl}`,
      source: "city-hiroshima",
      title,
      url: resolvedUrl,
      summary: undefined,
      published_at: now.slice(0, 10),
      deadline: null,
      target_area: ["広島市"],
      industry_tags: tagIndustries(title),
      amount_max: null,
      fetched_at: now,
    });
  });

  return items;
}

async function fetchHiroshimaRss(): Promise<Subsidy[]> {
  try {
    const res = await fetch(HIROSHIMA_RSS, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    const items: { title: string; link: string; pubDate?: string; description?: string }[] =
      parsed?.rss?.channel?.item ?? [];
    const now = new Date().toISOString();

    return items
      .filter((it) => containsKeyword(it.title ?? ""))
      .filter((it) => !shouldExclude(it.title ?? "", it.description))
      .map((it) => ({
        id: `hiroshima:${it.link}`,
        source: "city-hiroshima" as const,
        title: it.title,
        url: it.link,
        summary: it.description || undefined,
        published_at: it.pubDate ? new Date(it.pubDate).toISOString().slice(0, 10) : now.slice(0, 10),
        deadline: null,
        target_area: ["広島市"],
        industry_tags: tagIndustries(it.title ?? ""),
        amount_max: null,
        fetched_at: now,
      }));
  } catch (e) {
    console.error("Hiroshima RSS failed:", e);
    return [];
  }
}

export async function fetchHiroshimaSubsidies(): Promise<Subsidy[]> {
  try {
    const results = await Promise.all([
      ...HIROSHIMA_CATEGORY_URLS.map((p) => fetchHiroshimaCategory(p).catch(() => [] as Subsidy[])),
      fetchHiroshimaRss(),
    ]);
    const all = results.flat();
    const seen = new Set<string>();
    return all.filter((it) => {
      if (seen.has(it.url)) return false;
      seen.add(it.url);
      return true;
    });
  } catch (e) {
    console.error("Hiroshima fetch failed:", e);
    return [];
  }
}

// --- 統合 ---

export async function fetchAllCitySubsidies(): Promise<Subsidy[]> {
  const [hatsukaichi, shiso, hiroshima] = await Promise.all([
    fetchHatsukaichiSubsidies(),
    fetchShisoSubsidies(),
    fetchHiroshimaSubsidies(),
  ]);
  return [...hatsukaichi, ...shiso, ...hiroshima];
}
