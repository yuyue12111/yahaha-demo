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

# 2) public read on games/* + profile/* (uploads/* stays private). games/* = unsigned cross-origin
#    iframe nav；profile/* = 公开头像/背景图（浏览器 <img> 直读）。
mc anonymous set download "${ALIAS}/${BUCKET}/games"
mc anonymous set download "${ALIAS}/${BUCKET}/profile"

# 3) seed bundles (bind-mounted at /seed) → games/<slug>/<ver>/  (遍历，支持多个预制游戏)
echo "[minio-init] uploading seed bundles ..."
for dir in /seed/games/*/*/; do
  rel="${dir#/seed/}" # games/<slug>/<ver>/
  rel="${rel%/}"
  echo "  -> ${rel}/"
  mc cp --recursive "${dir}" "${ALIAS}/${BUCKET}/${rel}/"
done

echo "[minio-init] bucket contents:"
mc ls --recursive "${ALIAS}/${BUCKET}/games"
echo "[minio-init] done."
