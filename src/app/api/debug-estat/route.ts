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

  // 賃金クエリを直接テスト
  const wageTests = [
    { id: "0003030712", tab: "741", cat02: "840", cat03: "002", name: "名目大企業" },
    { id: "0003030712", tab: "741", cat02: "890", cat03: "002", name: "名目中小" },
    { id: "0003030713", tab: "741", cat02: "700", cat03: "002", name: "実質全規模" },
  ];
  for (const t of wageTests) {
    try {
      const url2 = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${apiKey}&statsDataId=${t.id}&cdTab=${t.tab}&cdCat01=1000000&cdCat02=${t.cat02}&cdCat03=${t.cat03}&limit=5&metaGetFlg=N&sectionHeaderFlg=1`;
      const res2 = await fetch(url2, { signal: AbortSignal.timeout(15000) });
      const data2 = await res2.json();
      const status = data2?.GET_STATS_DATA?.RESULT?.STATUS;
      const errMsg = data2?.GET_STATS_DATA?.RESULT?.ERROR_MSG;
      const values = data2?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
      results[`wage_${t.name}`] = {
        status, errMsg,
        valueCount: Array.isArray(values) ? values.length : 0,
        sample: values?.[0],
        last: values?.[values?.length - 1],
      };
    } catch (e) { results[`wage_${t.name}`] = String(e).slice(0, 100); }
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
