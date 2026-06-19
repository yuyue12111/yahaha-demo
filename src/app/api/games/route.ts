import { NextResponse } from "next/server";
import { listPublishedGames } from "@/lib/games";
import { GamesListResponse } from "@/lib/contracts/games";
import { errorEnvelope } from "@/lib/contracts/error";

export const dynamic = "force-dynamic";

// GET /api/games?status=published → { items: GameCard[], nextCursor? }（docs/03）
export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") ?? "published";
  if (status !== "published") {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", "CP2 仅支持 status=published"),
      { status: 422 },
    );
  }
  const items = await listPublishedGames();
  return NextResponse.json(GamesListResponse.parse({ items }));
}
