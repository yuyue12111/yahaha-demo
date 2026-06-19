"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand/StarLogo";
import { Button } from "@/components/ui/Button";

/** 侧栏（docs/10 §Sidebar nav）：顶部 Play 大 pill + nav，选中 = surface-2 底 + r-md。 */
const NAV = [
  { href: "/", label: "首页" },
  { href: "/create", label: "创作" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-[228px] shrink-0 flex-col gap-5 border-r border-hairline bg-surface px-4 py-5 md:flex">
      <Link href="/" className="px-1">
        <Brand />
      </Link>
      <Button variant="play" size="lg" href="/" className="w-full">
        ▶ 开始游玩
      </Button>
      <nav className="flex flex-col gap-1">
        {NAV.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                active ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
