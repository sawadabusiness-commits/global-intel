import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const API_DIR = path.resolve(__dirname, "../app/api");
const VERCEL_HOBBY_LIMIT = 60;

// 全APIルートの maxDuration が Vercel Hobbyプランの上限以内か
describe("Vercel timeout guard", () => {
  const apiRoutes = fs.readdirSync(API_DIR).filter((dir) => {
    const routePath = path.join(API_DIR, dir, "route.ts");
    return fs.existsSync(routePath);
  });

  it.each(apiRoutes)("/api/%s の maxDuration が %ds 以下", (route) => {
    const code = fs.readFileSync(path.join(API_DIR, route, "route.ts"), "utf-8");
    const match = code.match(/export\s+const\s+maxDuration\s*=\s*(\d+)/);

    expect(match, `${route}/route.ts に maxDuration が未設定`).not.toBeNull();
    const duration = Number(match![1]);
    expect(duration).toBeLessThanOrEqual(VERCEL_HOBBY_LIMIT);
  });
});
