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
    language: "en,ja",
    size: "10",
  });

  const res = await fetch(`${API_BASE}?${params}`, { cache: "no-store" });
  if (!res.ok) {
    console.error(`NewsData fetch failed for ${themeId}:`, res.status);
    return [];
  }

  const data: NewsDataResponse = await res.json();
  return data.results ?? [];
}

export async function fetchAllThemes(): Promise<{ themeId: ThemeId; articles: NewsDataArticle[] }[]> {
  const results = await Promise.all(
    THEMES.map(async (theme) => {
      // 少し間隔を開けてレート制限を避ける
      await new Promise((r) => setTimeout(r, 200));
      const articles = await fetchNewsByTheme(theme.id);
      return { themeId: theme.id, articles };
    })
  );
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
