import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ESTAT_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no ESTAT_API_KEY" });

  const results: Record<string, unknown> = {};

  // 毎月勤労統計の統計表を検索
  const candidates = [
    "0003145394", // 毎勤 長期時系列1
    "0003145395",
    "0003145396",
    "0004027245", // 最近のID
    "0004027246",
    "0004027247",
    "0003150100",
    "0003150101",
    "0003150102",
  ];

  for (const id of candidates) {
    try {
      const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${apiKey}&statsDataId=${id}&limit=3&metaGetFlg=Y`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) { results[id] = `HTTP ${res.status}`; continue; }
      const data = await res.json();
      const status = data?.GET_STATS_DATA?.RESULT?.STATUS;
      if (status !== 0) { results[id] = `error: ${data?.GET_STATS_DATA?.RESULT?.ERROR_MSG}`; continue; }

      const tableInf = data?.GET_STATS_DATA?.STATISTICAL_DATA?.TABLE_INF;
      const classInfo = data?.GET_STATS_DATA?.STATISTICAL_DATA?.CLASS_INF?.CLASS_OBJ;
      const values = data?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;

      const classes: Record<string, string[]> = {};
      if (Array.isArray(classInfo)) {
        for (const cls of classInfo) {
          const items = Array.isArray(cls.CLASS) ? cls.CLASS : [cls.CLASS].filter(Boolean);
          classes[`${cls["@id"]}(${cls["@name"]})`] = items.slice(0, 5).map((i: { "@code": string; "@name": string }) => `${i["@code"]}:${i["@name"]}`);
        }
      }

      results[id] = {
        title: tableInf?.STAT_NAME?.["$"] ?? tableInf?.TITLE?.["$"] ?? "?",
        tableTitle: tableInf?.TITLE?.["$"] ?? "?",
        cycle: tableInf?.CYCLE ?? "?",
        classes,
        sampleTime: values?.[0]?.["@time"],
      };
    } catch (e) { results[id] = `timeout/error: ${String(e).slice(0, 100)}`; }
  }

  // getStatsList で毎月勤労統計を検索
  try {
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList?appId=${apiKey}&searchWord=%E6%AF%8E%E6%9C%88%E5%8B%A4%E5%8A%B4%E7%B5%B1%E8%A8%88+%E8%B3%83%E9%87%91&limit=20`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    const tables = data?.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF;
    if (Array.isArray(tables)) {
      results.search = tables.map((t: any) => ({
        id: t["@id"],
        title: t.TITLE?.["$"] ?? t.STAT_NAME?.["$"],
        cycle: t.CYCLE,
        updated: t.UPDATED_DATE,
      }));
    } else {
      results.search = "no results";
    }
  } catch (e) { results.search_error = String(e).slice(0, 200); }

  return NextResponse.json(results);
}
