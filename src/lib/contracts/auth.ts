import { z } from "zod";

/** 注册 / 登录边界契约（docs/03 §鉴权）。在 route 与表单两侧用同一 schema。 */
export const RegisterSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位"),
  displayName: z.string().min(1, "请填写展示名").max(40),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;
