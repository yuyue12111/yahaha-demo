import { listPublishedGames } from "@/lib/games";
import { GameCard } from "@/components/game/GameCard";

// 查库渲染（非写死数组）；force-dynamic 避免 build 期触 DB。
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const games = await listPublishedGames();

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-ink">发现游戏</h1>
        <p className="mt-1 text-sm text-ink-muted">社区发布的 AI 互动游戏，点击即玩。</p>
      </div>

      {games.length === 0 ? (
        <p className="text-ink-muted">还没有已发布的游戏。</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
