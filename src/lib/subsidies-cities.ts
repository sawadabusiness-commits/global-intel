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

// --- 統合 ---

export async function fetchAllCitySubsidies(): Promise<Subsidy[]> {
  const [hatsukaichi, shiso] = await Promise.all([
    fetchHatsukaichiSubsidies(),
    fetchShisoSubsidies(),
  ]);
  return [...hatsukaichi, ...shiso];
}
