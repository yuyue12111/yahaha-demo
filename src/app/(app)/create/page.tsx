import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateStudio } from "@/components/create/CreateStudio";

// 受保护：middleware 已挡未登录；这里再做服务端 auth() 守卫（双保险，docs/03）。
export const dynamic = "force-dynamic";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ gameId?: string; remix?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/create");

  // ?gameId → 在已有游戏上生成新版本（B2）。仅作者本人；非作者/不存在则忽略（按新建处理，tasks 路由 403 兜底）。
  const { gameId, remix } = await searchParams;
  let regen: { gameId: string; title: string } | null = null;
  if (gameId) {
    const g = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, title: true, authorId: true },
    });
    if (g && g.authorId === session.user.id) regen = { gameId: g.id, title: g.title };
  }

  // ?remix → 基于任意已发布游戏二次创作（加分项 Remix）：用其标题/简介预填创意输入，用户改了再生成一个**新独立**游戏。
  let seedPrompt: string | undefined;
  if (remix && !regen) {
    const g = await prisma.game.findUnique({
      where: { id: remix },
      select: { title: true, summary: true, tags: true, status: true },
    });
    if (g && g.status === "PUBLISHED") {
      const tagLine = g.tags.length ? `（参考风格：${g.tags.join("、")}）` : "";
      seedPrompt = `基于《${g.title}》二次创作：${g.summary}${tagLine}。在此基础上加入我的新点子：`;
    }
  }

  // 满铺：CreateStudio 自管沉浸式布局（抵消 main 内边距 + 居中 hero），不再外套窄容器。
  return <CreateStudio regen={regen} seedPrompt={seedPrompt} />;
}
