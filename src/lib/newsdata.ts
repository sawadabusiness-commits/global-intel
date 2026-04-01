import { THEMES } from "./themes";
import type { NewsDataArticle, NewsDataResponse, ThemeId } from "./types";

const API_BASE = "https://newsdata.io/api/1/latest";

export async function fetchNewsByTheme(themeId: ThemeId): Promise<NewsDataArticle[]> {
  const theme = THEMES.find((t) => t.id === themeId);
  if (!theme) return [];

  const q = theme.queryKeywords.join(" OR ");
  const params = new URLSearchParams({
    apikey: process.env.NEWSDATA_API_KEY!,
    q,
    language: "en",
    size: "10",
  });

  try {
    const res = await fetch(`${API_BASE}?${params}`, { cache: "no-store" });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`NewsData fetch failed for ${themeId}: ${res.status} ${errText}`);
      return [];
    }

    const data: NewsDataResponse = await res.json();
    return data.results ?? [];
  } catch (e) {
    console.error(`NewsData fetch error for ${themeId}:`, e);
    return [];
  }
}

export async function fetchAllThemes(): Promise<{ themeId: ThemeId; articles: NewsDataArticle[] }[]> {
  const results: { themeId: ThemeId; articles: NewsDataArticle[] }[] = [];

  // 順番に実行してレート制限を避ける
  for (const theme of THEMES) {
    if (results.length > 0) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    const articles = await fetchNewsByTheme(theme.id);
    results.push({ themeId: theme.id, articles });
    console.log(`${theme.id}: ${articles.length} articles`);
  }

  return results;
}

export function deduplicateArticles(articles: NewsDataArticle[]): NewsDataArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.article_id)) return false;
    seen.add(a.article_id);
    return true;
  });
}
