import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorEnvelope } from "@/lib/contracts/error";
import { CreateTaskRequest, CreateTaskResponse } from "@/lib/contracts/tasks";
import { enqueueGeneration } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tasks（docs/03 §Tasks）—— 红线④锚点。
 * 写 GenerationTask(PENDING) + enqueue 后**立即 202 返回 taskId**，绝不在请求里跑模型/流水线。
 * 实际生成由独立 worker 进程异步消费（src/worker/index.ts）。
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(errorEnvelope("UNAUTHORIZED", "未登录"), { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", "请求体非合法 JSON"), { status: 422 });
  }

  const parsed = CreateTaskRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", "参数校验失败", { issues: parsed.error.flatten() }),
      { status: 422 },
    );
  }
  const { prompt, assetIds, gameId } = parsed.data;

  // 若指定 gameId（在已有游戏上再生成）→ 校验归属，越权 403（docs/07 §6）。
  if (gameId) {
    const g = await prisma.game.findUnique({ where: { id: gameId }, select: { authorId: true } });
    if (!g) return NextResponse.json(errorEnvelope("NOT_FOUND", "目标游戏不存在"), { status: 404 });
    if (g.authorId !== session.user.id) {
      return NextResponse.json(errorEnvelope("FORBIDDEN", "非作者，禁止操作"), { status: 403 });
    }
  }

  // MED-6：校验上传素材归属 —— 禁止引用他人/不存在的 assetId（IDOR / 存在性预言机，docs/07 §2 按用户隔离）。
  if (assetIds && assetIds.length > 0) {
    const ids = [...new Set(assetIds)];
    const owned = await prisma.asset.count({
      where: { id: { in: ids }, ownerId: session.user.id },
    });
    if (owned !== ids.length) {
      return NextResponse.json(
        errorEnvelope("FORBIDDEN", "包含非本人或不存在的素材"),
        { status: 403 },
      );
    }
  }

  const task = await prisma.generationTask.create({
    data: {
      userId: session.user.id,
      prompt,
      inputAssetIds: assetIds ?? [],
      gameId: gameId ?? null,
      status: "PENDING",
    },
    select: { id: true },
  });

  await enqueueGeneration(task.id);

  return NextResponse.json(CreateTaskResponse.parse({ taskId: task.id, status: "PENDING" }), {
    status: 202,
  });
}
