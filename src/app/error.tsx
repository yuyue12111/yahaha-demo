"use client";

import { Brand } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";

// 暗底品牌化错误边界（V4）：路由段渲染抛错时不掉默认白底页，给重试 + 返回首页。
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <Brand />
        <p className="text-[22px] font-bold text-ink">出错了</p>
        <p className="text-sm text-ink-muted">页面遇到一个错误。可以重试，或返回首页。</p>
        <div className="mt-1 flex gap-3">
          <Button variant="ghost" size="md" onClick={() => reset()}>
            重试
          </Button>
          <Button variant="primary" size="md" href="/">
            返回首页
          </Button>
        </div>
      </div>
    </main>
  );
}
