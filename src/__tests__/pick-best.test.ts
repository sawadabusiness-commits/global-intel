import { describe, it, expect } from "vitest";
import type { NewsDataArticle } from "@/lib/types";

// cron/route.ts の pickBestPerTheme と同じロジック
function pickBestPerTheme(
  themeResults: { themeId: string; articles: NewsDataArticle[] }[]
): NewsDataArticle[] {
  const picked: NewsDataArticle[] = [];
  const seen = new Set<string>();

  for (const { articles } of themeResults) {
    const sorted = [...articles]
      .filter((a) => a.description && a.description.length > 50)
      .sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0));

    for (const a of sorted) {
      if (!seen.has(a.article_id)) {
        seen.add(a.article_id);
        picked.push(a);
        break;
      }
    }
  }
  return picked;
}

function makeArticle(id: string, desc: string): NewsDataArticle {
  return {
    article_id: id,
    title: `Title ${id}`,
    link: `https://example.com/${id}`,
    description: desc,
    source_name: "Test",
    pubDate: "2026-01-01",
    country: ["US"],
  } as NewsDataArticle;
}

describe("pickBestPerTheme", () => {
  it("各テーマから1記事ずつ選ぶ", () => {
    const result = pickBestPerTheme([
      { themeId: "geo", articles: [makeArticle("a1", "x".repeat(60))] },
      { themeId: "tech", articles: [makeArticle("a2", "y".repeat(80))] },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.article_id)).toEqual(["a1", "a2"]);
  });

  it("description が50文字以下の記事は除外", () => {
    const result = pickBestPerTheme([
      { themeId: "geo", articles: [makeArticle("a1", "short")] },
    ]);
    expect(result).toHaveLength(0);
  });

  it("同じ記事IDが複数テーマに出ても重複しない", () => {
    const shared = makeArticle("dup", "z".repeat(100));
    const result = pickBestPerTheme([
      { themeId: "geo", articles: [shared] },
      { themeId: "tech", articles: [shared, makeArticle("a2", "w".repeat(60))] },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].article_id).toBe("dup");
    expect(result[1].article_id).toBe("a2");
  });

  it("descriptionが長い記事を優先する", () => {
    const result = pickBestPerTheme([
      {
        themeId: "geo",
        articles: [
          makeArticle("short", "a".repeat(60)),
          makeArticle("long", "b".repeat(200)),
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].article_id).toBe("long");
  });
});
