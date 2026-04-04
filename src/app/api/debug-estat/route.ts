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

  // limit=1000テスト + startPositionテスト
  try {
    // まずlimit=1000で全件取得
    const url2 = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${apiKey}&statsDataId=0003030712&cdTab=741&cdCat01=1000000&cdCat02=840&cdCat03=002&limit=1000&metaGetFlg=N&sectionHeaderFlg=1`;
    const res2 = await fetch(url2, { signal: AbortSignal.timeout(25000) });
    const data2 = await res2.json();
    const values = data2?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
    results.limit1000 = {
      valueCount: Array.isArray(values) ? values.length : 0,
      firstTime: values?.[0]?.["@time"],
      lastTime: values?.[values?.length - 1]?.["@time"],
      lastValue: values?.[values?.length - 1]?.["$"],
    };
  } catch (e) { results.limit1000 = `error: ${String(e).slice(0, 200)}`; }

  // startPosition=190で末尾取得
  try {
    const url3 = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${apiKey}&statsDataId=0003030712&cdTab=741&cdCat01=1000000&cdCat02=840&cdCat03=002&limit=50&startPosition=190&metaGetFlg=N&sectionHeaderFlg=1`;
    const res3 = await fetch(url3, { signal: AbortSignal.timeout(15000) });
    const data3 = await res3.json();
    const values3 = data3?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
    results.start190 = {
      status: data3?.GET_STATS_DATA?.RESULT?.STATUS,
      valueCount: Array.isArray(values3) ? values3.length : 0,
      firstTime: values3?.[0]?.["@time"],
      lastTime: values3?.[values3?.length - 1]?.["@time"],
      lastValue: values3?.[values3?.length - 1]?.["$"],
    };
  } catch (e) { results.start190 = `error: ${String(e).slice(0, 200)}`; }

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
