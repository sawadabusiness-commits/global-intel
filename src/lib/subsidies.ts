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

// 顧問先業種に該当しない製造業系・鉱業系を除外
// ただし food_manufacturing（パン製造小売）は顧問先なので除外しない
const EXCLUDE_KEYWORDS = [
  "鉱業", "鉱山", "採掘",
  "重工業", "鉄鋼", "金属加工", "素材産業",
  "化学工業", "石油化学", "プラスチック製造",
  "自動車製造", "自動車部品", "機械製造",
  "電機製造", "電子部品製造", "半導体製造",
  "造船", "航空機", "繊維製造",
];

export function shouldExclude(title: string, summary?: string): boolean {
  const text = title + (summary ?? "");
  // 食品製造は顧問先なので除外対象から守る
  if (["食品", "食料", "飲食", "製パン", "製菓", "加工食品"].some((k) => text.includes(k))) {
    return false;
  }
  return EXCLUDE_KEYWORDS.some((kw) => text.includes(kw));
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
        if (area && !matchesTargetArea(area)) return false;
        if (shouldExclude(it.title)) return false;
        return true;
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
      .filter((it) => !shouldExclude(it.title ?? "", it.description))
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

// --- J-Net21 支援情報ヘッドライン RSS ---

const JNET21_RSS_URL = "https://j-net21.smrj.go.jp/snavi/rss.rdf";
const JNET21_SUBSIDY_KEYWORDS = ["補助金", "助成金", "給付金", "支援金", "奨励金", "交付金", "融資"];

export async function fetchJNet21Subsidies(): Promise<Subsidy[]> {
  try {
    const res = await fetch(JNET21_RSS_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "global-intel-dashboard/1.0" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xml);
    // RDF or RSS形式
    const items: { title?: string; link?: string; description?: string; "dc:date"?: string }[] =
      parsed?.["rdf:RDF"]?.item ?? parsed?.rss?.channel?.item ?? [];
    const now = new Date().toISOString();

    return items
      .filter((it) => JNET21_SUBSIDY_KEYWORDS.some((kw) => (it.title ?? "").includes(kw)))
      .filter((it) => !shouldExclude(it.title ?? "", it.description))
      .map((it) => ({
        id: `j-net21:${it.link}`,
        source: "j-net21" as const,
        title: it.title ?? "",
        url: it.link ?? "",
        summary: it.description || undefined,
        published_at: it["dc:date"]
          ? it["dc:date"].slice(0, 10)
          : now.slice(0, 10),
        deadline: null,
        target_area: ["全国"],
        industry_tags: tagIndustries((it.title ?? "") + (it.description ?? "")),
        amount_max: null,
        fetched_at: now,
      }))
      .filter((it) => it.url); // URLなしは除外
  } catch (e) {
    console.error("J-Net21 RSS fetch failed:", e);
    return [];
  }
}

// --- 経産省 プレスリリース RSS ---

const METI_RSS_URL = "https://www.meti.go.jp/main/rss/rss.rdf";
const METI_SUBSIDY_KEYWORDS = ["補助金", "助成金", "給付金", "支援金", "交付金", "公募", "募集"];

export async function fetchMetiSubsidies(): Promise<Subsidy[]> {
  try {
    const res = await fetch(METI_RSS_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "global-intel-dashboard/1.0" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xml);
    const items: { title?: string; link?: string; description?: string; "dc:date"?: string; pubDate?: string }[] =
      parsed?.["rdf:RDF"]?.item ?? parsed?.rss?.channel?.item ?? [];
    const now = new Date().toISOString();

    return items
      .filter((it) => METI_SUBSIDY_KEYWORDS.some((kw) => (it.title ?? "").includes(kw)))
      .filter((it) => !shouldExclude(it.title ?? "", it.description))
      .map((it) => {
        const dateStr = it["dc:date"] ?? it.pubDate;
        const published = dateStr
          ? new Date(dateStr).toISOString().slice(0, 10)
          : now.slice(0, 10);
        return {
          id: `meti:${it.link}`,
          source: "meti" as const,
          title: it.title ?? "",
          url: it.link ?? "",
          summary: it.description || undefined,
          published_at: published,
          deadline: null,
          target_area: ["全国"],
          industry_tags: tagIndustries((it.title ?? "") + (it.description ?? "")),
          amount_max: null,
          fetched_at: now,
        };
      })
      .filter((it) => it.url);
  } catch (e) {
    console.error("METI RSS fetch failed:", e);
    return [];
  }
}

// --- 統合フェッチ ---

export async function fetchAllSubsidies(): Promise<Subsidy[]> {
  const { fetchAllCitySubsidies } = await import("./subsidies-cities");
  const { fetchChuShoSubsidies } = await import("./subsidies-chusho");
  const [jgrants, mhlw, jnet21, meti, chusho, cities] = await Promise.all([
    fetchJGrants(),
    fetchMhlwSubsidies(),
    fetchJNet21Subsidies(),
    fetchMetiSubsidies(),
    fetchChuShoSubsidies(),
    fetchAllCitySubsidies(),
  ]);
  return [...jgrants, ...mhlw, ...jnet21, ...meti, ...chusho, ...cities];
}
