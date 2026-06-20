import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/db";
import { errorEnvelope } from "@/lib/contracts/error";
import { CreateTaskResponse } from "@/lib/contracts/tasks";
import { enqueueGeneration } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tasks/:id/retry（docs/03 + docs/08 §重试）—— 从失败任务重排（新 attempt）。
 * 清旧 AgentLog 让步骤流干净重跑；复用同 gameId（若有）；再入队，立即 202。仅本人、仅 FAILED 可重试。
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const task = await prisma.generationTask.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!task) {
    return NextResponse.json(errorEnvelope("NOT_FOUND", "任务不存在"), { status: 404 });
  }
  if (task.userId !== gate.user.id) {
    return NextResponse.json(errorEnvelope("FORBIDDEN", "非本人任务"), { status: 403 });
  }
  if (task.status !== "FAILED") {
    return NextResponse.json(errorEnvelope("CONFLICT", "仅失败任务可重试"), { status: 409 });
  }

  await prisma.agentLog.deleteMany({ where: { taskId: id } });
  await prisma.generationTask.update({
    where: { id },
    data: {
      status: "PENDING",
      currentStep: null,
      error: null,
      startedAt: null,
      finishedAt: null,
      attempt: { increment: 1 },
    },
  });
  await enqueueGeneration(id);

  return NextResponse.json(CreateTaskResponse.parse({ taskId: id, status: "PENDING" }), {
    status: 202,
  });
}
