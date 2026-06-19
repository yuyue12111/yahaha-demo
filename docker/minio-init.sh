#!/bin/sh
# One-shot bootstrap: wait for MinIO → create bucket → public-read on games/* → upload seed bundle.
# Robust to MinIO not-yet-ready (retry loop) regardless of healthcheck tooling in the server image.
set -eu

ALIAS=local
ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
ACCESS="${MINIO_ROOT_USER:-minioadmin}"
SECRET="${MINIO_ROOT_PASSWORD:-minioadmin}"
BUCKET="${S3_BUCKET:-yahaha}"

echo "[minio-init] waiting for MinIO at ${ENDPOINT} ..."
i=0
until mc alias set "${ALIAS}" "${ENDPOINT}" "${ACCESS}" "${SECRET}" >/dev/null 2>&1 && mc ls "${ALIAS}" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "${i}" -ge 60 ]; then
    echo "[minio-init] ERROR: MinIO not ready after 60 attempts" >&2
    exit 1
  fi
  sleep 2
done
echo "[minio-init] MinIO ready."

# 1) bucket (idempotent)
mc mb --ignore-existing "${ALIAS}/${BUCKET}"

# 2) public read on games/* ONLY (uploads/* stays private). Enables unsigned cross-origin iframe nav.
mc anonymous set download "${ALIAS}/${BUCKET}/games"

# 3) seed bundle (bind-mounted at /seed) → games/neon-dodger/1/
echo "[minio-init] uploading seed bundle ..."
mc cp --recursive /seed/games/neon-dodger/1/ "${ALIAS}/${BUCKET}/games/neon-dodger/1/"

echo "[minio-init] bucket contents:"
mc ls --recursive "${ALIAS}/${BUCKET}/games"
echo "[minio-init] done."
