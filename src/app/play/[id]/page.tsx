import { resolveActiveVersion } from "@/lib/active-version";
import { PlayShell } from "@/components/play/PlayShell";

// Resolves the manifest from MinIO per request (server-side, no CORS).
export const dynamic = "force-dynamic";

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await resolveActiveVersion(id);

  return (
    <PlayShell
      gameId={id}
      active={result.ok ? result.data : null}
      resolveError={
        result.ok ? null : { status: result.status, error: result.error, detail: result.detail ?? null }
      }
    />
  );
}
