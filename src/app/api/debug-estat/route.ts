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

  // テスト1: limit=50でそのまま取得
  try {
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${apiKey}&statsDataId=0003030976&cdTab=803&cdCat01=1000000&cdCat02=700&limit=50&metaGetFlg=N&sectionHeaderFlg=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    const status = data?.GET_STATS_DATA?.RESULT?.STATUS;
    const values = data?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
    const totalNumber = data?.GET_STATS_DATA?.STATISTICAL_DATA?.TABLE_INF?.TOTAL_NUMBER
      ?? data?.GET_STATS_DATA?.STATISTICAL_DATA?.RESULT_INF?.TOTAL_NUMBER;
    results.test1_limit50 = {
      status,
      totalNumber,
      valueCount: Array.isArray(values) ? values.length : 0,
      firstTime: values?.[0]?.["@time"],
      lastTime: values?.[values?.length - 1]?.["@time"],
      firstValue: values?.[0]?.["$"],
      lastValue: values?.[values?.length - 1]?.["$"],
    };
  } catch (e) { results.test1_error = String(e); }

  // テスト2: limit=1000で取得
  try {
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${apiKey}&statsDataId=0003030976&cdTab=803&cdCat01=1000000&cdCat02=700&limit=1000&metaGetFlg=N&sectionHeaderFlg=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    const values = data?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
    results.test2_limit1000 = {
      valueCount: Array.isArray(values) ? values.length : 0,
      lastTime: values?.[values?.length - 1]?.["@time"],
      lastValue: values?.[values?.length - 1]?.["$"],
    };
  } catch (e) { results.test2_error = String(e); }

  // テスト3: startPosition=180で取得（最新部分）
  try {
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${apiKey}&statsDataId=0003030976&cdTab=803&cdCat01=1000000&cdCat02=700&limit=50&startPosition=180&metaGetFlg=N&sectionHeaderFlg=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    const values = data?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
    results.test3_start180 = {
      valueCount: Array.isArray(values) ? values.length : 0,
      firstTime: values?.[0]?.["@time"],
      lastTime: values?.[values?.length - 1]?.["@time"],
    };
  } catch (e) { results.test3_error = String(e); }

  return NextResponse.json(results);
}
