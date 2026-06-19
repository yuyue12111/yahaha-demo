import { NextResponse } from "next/server";
import { listPublishedGames, type GamesSort } from "@/lib/games";
import { GamesListResponse } from "@/lib/contracts/games";
import { errorEnvelope } from "@/lib/contracts/error";

export const dynamic = "force-dynamic";

// GET /api/games?status=published&search=&tag=&sort=newest|popular&cursor=&limit= → { items, nextCursor? }（docs/03:30）
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;

  const status = sp.get("status") ?? "published";
  if (status !== "published") {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", "CP2 仅支持 status=published"),
      { status: 422 },
    );
  }

  let sort: GamesSort = "newest";
  const sortRaw = sp.get("sort");
  if (sortRaw != null) {
    if (sortRaw !== "newest" && sortRaw !== "popular") {
      return NextResponse.json(
        errorEnvelope("VALIDATION_ERROR", "sort 仅支持 newest|popular"),
        { status: 422 },
      );
    }
    sort = sortRaw;
  }

  let limit: number | undefined;
  const limitRaw = sp.get("limit");
  if (limitRaw != null) {
    const n = Number(limitRaw);
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      return NextResponse.json(
        errorEnvelope("VALIDATION_ERROR", "limit 须为 1..60 的整数"),
        { status: 422 },
      );
    }
    limit = n;
  }

  const result = await listPublishedGames({
    search: sp.get("search") ?? undefined,
    tag: sp.get("tag") ?? undefined,
    sort,
    cursor: sp.get("cursor") ?? undefined,
    limit,
  });
  return NextResponse.json(GamesListResponse.parse(result));
}
