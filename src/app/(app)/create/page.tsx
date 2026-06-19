import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CreateStudio } from "@/components/create/CreateStudio";

// 受保护：middleware 已挡未登录；这里再做服务端 auth() 守卫（双保险，docs/03）。
export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/create");

  return (
    <div className="mx-auto max-w-5xl">
      <CreateStudio />
    </div>
  );
}
