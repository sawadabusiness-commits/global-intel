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

  // 候補テーブルのメタデータ確認
  const checkIds = ["0003030712", "0003030713"];
  for (const id of checkIds) {
    try {
      const url2 = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${apiKey}&statsDataId=${id}&limit=5&metaGetFlg=Y`;
      const res2 = await fetch(url2, { signal: AbortSignal.timeout(15000) });
      const data2 = await res2.json();
      const classInfo = data2?.GET_STATS_DATA?.STATISTICAL_DATA?.CLASS_INF?.CLASS_OBJ;
      const values = data2?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
      const classes: Record<string, string[]> = {};
      if (Array.isArray(classInfo)) {
        for (const cls of classInfo) {
          const items = Array.isArray(cls.CLASS) ? cls.CLASS : [cls.CLASS].filter(Boolean);
          classes[`${cls["@id"]}(${cls["@name"]})`] = items.slice(0, 8).map((i: any) => `${i["@code"]}:${i["@name"]}`);
        }
      }
      const totalNumber = data2?.GET_STATS_DATA?.STATISTICAL_DATA?.TABLE_INF?.TOTAL_NUMBER;
      results[`meta_${id}`] = { totalNumber, classes, sampleValue: values?.[0] };
    } catch (e) { results[`meta_${id}`] = String(e).slice(0, 100); }
  }

  // getStatsList で毎月勤労統計を検索
  try {
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList?appId=${apiKey}&searchWord=%E6%AF%8E%E6%9C%88%E5%8B%A4%E5%8A%B4%E7%B5%B1%E8%A8%88+%E8%B3%83%E9%87%91&limit=20`;
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
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
