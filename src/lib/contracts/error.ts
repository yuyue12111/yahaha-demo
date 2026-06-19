import { z } from "zod";

/**
 * 统一错误信封 — docs/03 §统一错误信封 的运行时单一真源。
 * 所有 HTTP 错误体走这个形状 `{ error: { code, message, details? } }`，
 * 别让每个端点各自发明扁平 `{error:string}`（MED-6 / LOW-3）。
 */
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
] as const;
export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorEnvelope = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

/** 构造并自校验一个错误信封（错误体也走 Zod）。 */
export function errorEnvelope(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ErrorEnvelope {
  return ErrorEnvelope.parse({
    error: { code, message, ...(details ? { details } : {}) },
  });
}
