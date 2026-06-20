import { Brand } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";

// 暗底品牌化 404（V4）：坏链不再掉 Next 默认白底页、撞碎暗色品牌。
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <Brand />
        <p className="text-[64px] font-extrabold leading-none text-ink">404</p>
        <p className="text-sm text-ink-muted">这个页面不存在，或游戏已被移除。</p>
        <Button href="/" variant="primary" size="md" className="mt-1">
          返回首页
        </Button>
      </div>
    </main>
  );
}
