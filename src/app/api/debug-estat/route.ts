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

  // 賃金指数で最新データを持つテーブルを探す
  // 産業分類改定ごとにIDが変わるので、searchで「賃金指数」を検索し最終更新が新しいものを取得
  try {
    const url2 = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList?appId=${apiKey}&searchWord=%E4%BA%8B%E6%A5%AD%E6%89%80%E8%A6%8F%E6%A8%A1%E5%88%A5%E8%B3%83%E9%87%91%E6%8C%87%E6%95%B0&limit=20`;
    const res2 = await fetch(url2, { signal: AbortSignal.timeout(25000) });
    const data2 = await res2.json();
    const tables = data2?.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF;
    if (Array.isArray(tables)) {
      results.wage_search = tables.map((t: any) => ({
        id: t["@id"],
        title: t.TITLE?.["$"],
        cycle: t.CYCLE,
        updated: t.UPDATED_DATE,
        surveyDate: t.SURVEY_DATE,
      }));
    }
  } catch (e) { results.wage_search = String(e).slice(0, 200); }

  // 実質賃金で検索
  try {
    const url3 = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList?appId=${apiKey}&searchWord=%E5%AE%9F%E8%B3%AA%E8%B3%83%E9%87%91%E6%8C%87%E6%95%B0&limit=20`;
    const res3 = await fetch(url3, { signal: AbortSignal.timeout(25000) });
    const data3 = await res3.json();
    const tables = data3?.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF;
    if (Array.isArray(tables)) {
      results.real_wage_search = tables.map((t: any) => ({
        id: t["@id"],
        title: t.TITLE?.["$"],
        updated: t.UPDATED_DATE,
      }));
    }
  } catch (e) { results.real_wage_search = String(e).slice(0, 200); }

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
