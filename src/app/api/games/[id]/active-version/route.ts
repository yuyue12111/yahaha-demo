import { NextResponse } from "next/server";
import { resolveActiveVersion } from "@/lib/active-version";

// Reads from MinIO at request time — never statically optimized.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await resolveActiveVersion(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
