/**
 * 本地 Demo OAuth IdP 的固定身份与常量（仅用于演示 授权→回调→账号绑定；非真实用户/非真实 IdP）。
 * 三端点 /api/demo-oauth/{authorize,token,userinfo} 共用。env ENABLE_DEMO_OAUTH 控制启用（compose 默认开）。
 * 跑的是和 Google/GitHub 完全相同的 NextAuth 回调 + linkOAuthAccount 代码路径 —— 证明 OAuth 机器真能端到端跑通，无需真密钥（红线⑤）。
 */
export const DEMO_OAUTH_USER = {
  sub: "demo-oauth-001",
  name: "Demo OAuth User",
  email: "demo.oauth@yahaha.dev",
  picture: null as string | null,
};

export const DEMO_OAUTH_CODE = "demo-auth-code";
export const DEMO_OAUTH_TOKEN = "demo-access-token";

/** 本站 origin（回跳校验 / IdP 端点基址）。 */
export function appOrigin(): string {
  return new URL(process.env.AUTH_URL ?? "http://localhost:3000").origin;
}
