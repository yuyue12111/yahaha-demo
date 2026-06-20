import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/db";
import { publicUrl } from "@/lib/storage";
import { errorEnvelope } from "@/lib/contracts/error";
import { dbToWire } from "@/lib/contracts/runtime";
import type { TaskDoneData } from "@/lib/contracts/tasks";
import { subscribeTaskEvents } from "@/lib/events";
import { toLogDTO } from "@/lib/task-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * GET /api/tasks/:id/stream（docs/03 §SSE）—— worker 经 Redis pub/sub 发事件，本端点中继。
 * 先发当前快照（status + 既有 logs）让晚订阅者追平，再转发实时事件；done 后关闭。仅本人可订阅。
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const task = await prisma.generationTask.findUnique({
    where: { id },
    include: { logs: { orderBy: { seq: "asc" } } },
  });
  if (!task) return json(errorEnvelope("NOT_FOUND", "任务不存在"), 404);
  if (task.userId !== gate.user.id) return json(errorEnvelope("FORBIDDEN", "非本人任务"), 403);

  const encoder = new TextEncoder();

  // MED-3：终态 done 也带预览字段（gameId/versionNumber/runtime/entryUrl/manifestUrl），从 resultVersion 回填，
  // 与实时 done 同形 → 重连/刷新后的客户端也能直接预览 PREVIEW 产物。
  let terminalDone: TaskDoneData | null = null;
  if (task.status === "FAILED") {
    terminalDone = { status: "FAILED", error: task.error ?? undefined };
  } else if (task.status === "SUCCEEDED") {
    const v = task.resultVersionId
      ? await prisma.version.findUnique({
          where: { id: task.resultVersionId },
          select: { gameId: true, versionNumber: true, runtime: true, manifestKey: true },
        })
      : null;
    terminalDone = v
      ? {
          status: "SUCCEEDED",
          versionId: task.resultVersionId ?? undefined,
          gameId: v.gameId,
          versionNumber: v.versionNumber,
          runtime: dbToWire(v.runtime),
          manifestUrl: publicUrl(v.manifestKey),
          entryUrl: publicUrl(`${v.manifestKey.replace(/\/[^/]*$/, "")}/index.html`),
        }
      : { status: "SUCCEEDED", versionId: task.resultVersionId ?? undefined };
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const write = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          open = false;
        }
      };

      // 1) 快照：当前状态 + 既有日志（重连/晚订阅也能立即重建 UI）。
      write("status", { status: task.status, currentStep: task.currentStep });
      for (const l of task.logs) write("log", toLogDTO(l));

      // 2) 已终态 → 直接补 done（带预览字段）并关闭（无需订阅）。
      if (terminalDone) {
        write("done", terminalDone);
        open = false;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        return;
      }

      // 3) 心跳保活 + 订阅实时事件。
      const hb = setInterval(() => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          open = false;
        }
      }, 15_000);

      const cleanup = subscribeTaskEvents(
        id,
        (e) => {
          write(e.event, e.data);
          if (e.event === "done") {
            clearInterval(hb);
            open = false;
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          }
        },
        req.signal,
      );

      req.signal.addEventListener(
        "abort",
        () => {
          clearInterval(hb);
          open = false;
          cleanup();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
        { once: true },
      );
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
