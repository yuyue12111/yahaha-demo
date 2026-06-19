import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorEnvelope } from "@/lib/contracts/error";
import { TaskDetailResponse } from "@/lib/contracts/tasks";
import { toLogDTO, toTaskDTO } from "@/lib/task-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/:id（docs/03）—— 轮询兜底：任一时刻可用它重建当前状态（SSE 仅体验增强）。
 * 仅本人可见（越权 403）。
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(errorEnvelope("UNAUTHORIZED", "未登录"), { status: 401 });
  }
  const { id } = await params;
  const task = await prisma.generationTask.findUnique({
    where: { id },
    include: { logs: { orderBy: { seq: "asc" } } },
  });
  if (!task) {
    return NextResponse.json(errorEnvelope("NOT_FOUND", "任务不存在"), { status: 404 });
  }
  if (task.userId !== session.user.id) {
    return NextResponse.json(errorEnvelope("FORBIDDEN", "非本人任务"), { status: 403 });
  }
  return NextResponse.json(
    TaskDetailResponse.parse({ task: toTaskDTO(task), logs: task.logs.map(toLogDTO) }),
  );
}
