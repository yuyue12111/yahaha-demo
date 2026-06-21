import { env } from "@/lib/env";
import { DEMO_OAUTH_CODE, DEMO_OAUTH_USER, appOrigin } from "@/lib/demo-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo OAuth IdP — authorization endpoint。NextAuth 把浏览器重定向到此（带 redirect_uri + state）。
 * 渲染一个最小「授权同意」页 → 用户点「授权登录」→ 回跳 redirect_uri?code=&state=（即 NextAuth 回调）。
 * 防开放重定向：redirect_uri 必须回本站。PKCE 的 code_challenge 忽略（最小 IdP，演示用）。
 */
export async function GET(req: Request): Promise<Response> {
  if (!env.ENABLE_DEMO_OAUTH) return new Response("Demo OAuth 未启用", { status: 404 });

  const url = new URL(req.url);
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";

  if (!redirectUri.startsWith(appOrigin())) {
    return new Response("invalid redirect_uri", { status: 400 });
  }

  const approve = `${redirectUri}?code=${encodeURIComponent(DEMO_OAUTH_CODE)}&state=${encodeURIComponent(state)}`;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Demo OAuth 授权</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0a14;color:#e7e3f2;
       font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .card{width:min(92vw,380px);border:1px solid rgba(255,255,255,.1);border-radius:16px;background:#161122;
        padding:26px;box-shadow:0 24px 70px -20px rgba(124,92,255,.5)}
  .tag{display:inline-block;font:11px/1 ui-monospace,monospace;letter-spacing:.08em;color:#9b91c4;
       border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:5px 10px;margin-bottom:16px}
  h1{font-size:17px;margin:0 0 6px}
  p{color:#9b91c4;margin:0 0 18px;font-size:13px}
  .user{display:flex;align-items:center;gap:11px;border:1px solid rgba(255,255,255,.1);border-radius:12px;
        padding:12px;margin-bottom:18px;background:#0e0b18}
  .av{width:38px;height:38px;border-radius:999px;display:grid;place-items:center;font-weight:800;color:#0c0a14;
      background:linear-gradient(140deg,#27e0ff,#7c5cff)}
  .nm{font-weight:700}.em{color:#9b91c4;font-size:12px}
  a.btn{display:block;text-align:center;text-decoration:none;background:linear-gradient(120deg,#27e0ff,#7c5cff);
        color:#0c0a14;font-weight:800;border-radius:12px;padding:13px;letter-spacing:.02em}
  .note{margin-top:14px;font-size:11px;color:#6f6790;text-align:center}
</style></head><body>
  <div class="card">
    <span class="tag">DEMO OAuth IdP · 本地仿第三方登录</span>
    <h1>授权登录到 Yahaha</h1>
    <p>Yahaha 请求使用以下账号登录（演示用，非真实第三方）：</p>
    <div class="user">
      <span class="av">D</span>
      <span><span class="nm">${DEMO_OAUTH_USER.name}</span><br/><span class="em">${DEMO_OAUTH_USER.email}</span></span>
    </div>
    <a class="btn" href="${approve.replace(/"/g, "&quot;")}">授权登录</a>
    <div class="note">点击后将回调 /api/auth/callback/demo，由 NextAuth 完成账号绑定。</div>
  </div>
</body></html>`;

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
