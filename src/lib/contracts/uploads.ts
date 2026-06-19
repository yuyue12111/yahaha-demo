import { z } from "zod";

/**
 * 上传素材 presigned 直传契约（docs/03 §Uploads + docs/07 §2）。
 * 浏览器拿 putUrl 后**直传 MinIO**，绝不经 app 落盘。
 */

/** 允许的 contentType 白名单（docs/07 §2）。bytes 上限在路由按 env.MAX_UPLOAD_BYTES 校验（413）。 */
export function isAllowedUploadType(contentType: string): boolean {
  const ct = contentType.toLowerCase().split(";")[0].trim();
  return (
    ct.startsWith("image/") ||
    ct === "video/mp4" ||
    ct === "text/plain" ||
    ct === "application/json"
  );
}

export const PresignRequest = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
  bytes: z.number().int().positive(),
});
export type PresignRequest = z.infer<typeof PresignRequest>;

export const PresignResponse = z.object({
  assetId: z.string().min(1),
  key: z.string().min(1),
  putUrl: z.string().url(),
  getUrl: z.string().url(),
  expiresIn: z.number().int().positive(),
});
export type PresignResponse = z.infer<typeof PresignResponse>;

/** 从原始文件名/MIME 推一个安全的小写扩展名（key 用；无则回退 bin）。 */
export function extFor(filename: string, contentType: string): string {
  const fromName = filename.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  if (fromName) return fromName;
  const ct = contentType.toLowerCase().split(";")[0].trim();
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "text/plain": "txt",
    "application/json": "json",
  };
  return map[ct] ?? "bin";
}
