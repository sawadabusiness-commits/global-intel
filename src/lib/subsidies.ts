import { XMLParser } from "fast-xml-parser";
import type { Subsidy, IndustryTag } from "./types";

// 対象地域フィルタ（全国＋沢田事務所の顧問先所在地）
const TARGET_REGIONS = ["全国", "広島県", "広島市", "廿日市市", "兵庫県", "宍粟市"];

// 業種タグのキーワードマッチング
const INDUSTRY_KEYWORDS: Record<IndustryTag, string[]> = {
  medical: ["医療", "病院", "診療", "クリニック", "医師", "看護"],
  welfare: ["福祉", "介護", "障害", "高齢", "保育", "子育て"],
  construction: ["建設", "建築", "土木", "工事", "インフラ"],
  food_manufacturing: ["食品", "食料", "飲食", "製パン", "製菓", "加工"],
  retail: ["小売", "販売", "店舗", "卸売", "商店"],
  general: [],
};

export function tagIndustries(text: string): IndustryTag[] {
  const lower = text;
  const tags: IndustryTag[] = [];
  for (const [tag, keywords] of Object.entries(INDUSTRY_KEYWORDS) as [IndustryTag, string[]][]) {
    if (keywords.some((kw) => lower.includes(kw))) {
      tags.push(tag);
    }
  }
  if (tags.length === 0) tags.push("general");
  return tags;
}

// 対象地域に含まれるかチェック
function matchesTargetArea(area: string): boolean {
  if (!area) return true; // 不明は含める
  return TARGET_REGIONS.some((r) => area.includes(r));
}

// --- jGrants API ---

interface JGrantsRaw {
  id: string;
  name: string;
  title: string;
  target_area_search: string;
  subsidy_max_limit: number | null;
  acceptance_start_datetime?: string;
  acceptance_end_datetime?: string;
}

export async function fetchJGrants(): Promise<Subsidy[]> {
  const url = "https://api.jgrants-portal.go.jp/exp/v1/public/subsidies?keyword=%E8%A3%9C%E5%8A%A9%E9%87%91&sort=created_date&order=DESC&acceptance=1";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const items: JGrantsRaw[] = data.result ?? [];
    const now = new Date().toISOString();

    return items
      .filter((it) => {
        const area = it.target_area_search ?? "";
        return !area || matchesTargetArea(area);
      })
      .map((it) => {
        const areas = (it.target_area_search ?? "全国")
          .split(/[\/、,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const detailUrl = `https://www.jgrants-portal.go.jp/subsidy/${it.id}`;
        return {
          id: `jgrants:${it.id}`,
          source: "jgrants" as const,
          title: it.title,
          url: detailUrl,
          summary: undefined,
          published_at: it.acceptance_start_datetime ?? now,
          deadline: it.acceptance_end_datetime ?? null,
          target_area: areas.length > 0 ? areas : ["全国"],
          industry_tags: tagIndustries(it.title),
          amount_max: it.subsidy_max_limit ?? null,
          fetched_at: now,
        };
      });
  } catch (e) {
    console.error("jGrants fetch failed:", e);
    return [];
  }
}

// --- 厚労省 RSS ---

interface MhlwItem {
  title: string;
  link: string;
  description?: string;
  "dc:date"?: string;
  date?: string;
}

const SUBSIDY_KEYWORDS_RSS = ["助成金", "補助金", "雇用調整", "キャリアアップ", "両立支援", "人材開発", "職場定着"];

export async function fetchMhlwSubsidies(): Promise<Subsidy[]> {
  const url = "https://www.mhlw.go.jp/stf/news.rdf";
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "global-intel-dashboard/1.0" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xml);
    const items: MhlwItem[] = parsed?.["rdf:RDF"]?.item ?? [];
    const now = new Date().toISOString();

    return items
      .filter((it) => SUBSIDY_KEYWORDS_RSS.some((kw) => (it.title ?? "").includes(kw)))
      .map((it) => ({
        id: `mhlw:${it.link}`,
        source: "mhlw" as const,
        title: it.title,
        url: it.link,
        summary: it.description,
        published_at: it["dc:date"] ?? it.date ?? now,
        deadline: null,
        target_area: ["全国"],
        industry_tags: tagIndustries((it.title ?? "") + (it.description ?? "")),
        amount_max: null,
        fetched_at: now,
      }));
  } catch (e) {
    console.error("MHLW RSS fetch failed:", e);
    return [];
  }
}

// --- 統合フェッチ ---

export async function fetchAllSubsidies(): Promise<Subsidy[]> {
  const [jgrants, mhlw] = await Promise.all([
    fetchJGrants(),
    fetchMhlwSubsidies(),
  ]);
  return [...jgrants, ...mhlw];
}
