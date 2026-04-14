import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import type { Subsidy } from "./types";
import { tagIndustries, shouldExclude } from "./subsidies";

const UA = "Mozilla/5.0 (compatible; global-intel-dashboard/1.0)";
const CHUSHO_BASE = "https://www.chusho.meti.go.jp";

// 取得対象キーワード（事業承継・M&A・補助金・税制を中心に）
const CHUSHO_KEYWORDS = [
  "補助金", "助成金", "給付金", "支援金", "交付金",
  "公募", "申請受付",
  "事業承継", "後継者", "経営承継", "第三者承継",
  "M&A", "マッチング",
  "税額控除", "税制", "特例",
  "ものづくり", "持続化", "省力化", "事業再構築",
  "IT導入", "デジタル", "DX",
  "経営革新", "経営力向上",
  "創業", "スタートアップ",
];

function matchesChusho(title: string, desc?: string): boolean {
  const text = title + (desc ?? "");
  return CHUSHO_KEYWORDS.some((kw) => text.includes(kw));
}

// --- RSSフィード (RDF形式) ---

interface RdfItem {
  title?: string;
  link?: string;
  description?: string;
  "dc:date"?: string;
}

export async function fetchChuShoRss(): Promise<Subsidy[]> {
  try {
    const res = await fetch(`${CHUSHO_BASE}/rss/index.xml`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xml);
    const items: RdfItem[] = parsed?.["rdf:RDF"]?.item ?? [];
    const now = new Date().toISOString();

    return items
      .filter((it) => matchesChusho(it.title ?? "", it.description))
      .filter((it) => !shouldExclude(it.title ?? "", it.description))
      .map((it) => {
        const url = it.link ?? "";
        const dateStr = it["dc:date"];
        const published = dateStr
          ? new Date(dateStr).toISOString().slice(0, 10)
          : now.slice(0, 10);
        return {
          id: `chusho:${url}`,
          source: "chusho" as const,
          title: it.title ?? "",
          url,
          summary: it.description && it.description !== "詳細はホームページでご確認ください"
            ? it.description
            : undefined,
          published_at: published,
          deadline: extractDeadline(it.title ?? ""),
          target_area: ["全国"],
          industry_tags: tagIndustries(it.title ?? ""),
          amount_max: null,
          fetched_at: now,
        };
      })
      .filter((it) => it.url);
  } catch (e) {
    console.error("ChuSho RSS fetch failed:", e);
    return [];
  }
}

// --- 補助金公募一覧ページ ---

export async function fetchChuShoHojyokin(): Promise<Subsidy[]> {
  try {
    const res = await fetch(`${CHUSHO_BASE}/koukai/hojyokin/index.html`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const now = new Date().toISOString();
    const items: Subsidy[] = [];

    $("a").each((_, el) => {
      const $a = $(el);
      const title = $a.text().replace(/<[^>]+>/g, "").trim();
      const href = $a.attr("href") ?? "";
      if (!title || !href) return;
      if (title.length < 8) return;
      // 補助金公募ページへのリンク（kobo/ or hojyokin/ 配下）
      if (!/\/(kobo|hojyokin)\//.test(href) && !/\.(html?)$/.test(href)) return;
      if (shouldExclude(title)) return;

      const url = href.startsWith("http") ? href : CHUSHO_BASE + (href.startsWith("/") ? href : "/" + href);
      const parentText = $a.closest("li, dd, tr").text();
      const dateMatch = parentText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      const published = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
        : now.slice(0, 10);

      items.push({
        id: `chusho:${url}`,
        source: "chusho" as const,
        title,
        url,
        summary: undefined,
        published_at: published,
        deadline: extractDeadline(title),
        target_area: ["全国"],
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
    console.error("ChuSho hojyokin page fetch failed:", e);
    return [];
  }
}

// タイトルから締切日を抽出: 【申請受付期間：X/X～X/X】 パターン
function extractDeadline(title: string): string | null {
  // 【申請受付期間：4/3～5/8】
  const m1 = title.match(/[（(]?申請受付[期間：:]*[^~～〜]*[~～〜](\d{1,2}\/\d{1,2})[）)\]】]/);
  if (m1) {
    const year = new Date().getFullYear();
    const [month, day] = m1[1].split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  // ～X月X日 パターン
  const m2 = title.match(/[~～〜](\d{1,2})月(\d{1,2})日/);
  if (m2) {
    const year = new Date().getFullYear();
    return `${year}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
  }
  return null;
}

// --- 統合 ---

export async function fetchChuShoSubsidies(): Promise<Subsidy[]> {
  const [rss, hojyokin] = await Promise.all([
    fetchChuShoRss(),
    fetchChuShoHojyokin(),
  ]);

  // URL重複排除（hojyokinが重複したらrssを優先）
  const seen = new Set<string>();
  const merged: Subsidy[] = [];
  for (const it of [...rss, ...hojyokin]) {
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    merged.push(it);
  }
  return merged;
}
