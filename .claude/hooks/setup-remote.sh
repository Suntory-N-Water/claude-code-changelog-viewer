#!/usr/bin/env bash
set -euo pipefail

# cloud セッションでは作業ツリーが毎回作り直され node_modules が無い状態で始まる
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

log=$(mktemp)
# CI 判定時 lefthook は hooks の設置を飛ばすので、cloud では明示的に有効化する
if LEFTHOOK=1 pnpm install --frozen-lockfile >"$log" 2>&1; then
  echo "pnpm install が完了しました。"
else
  # SessionStart は失敗してもセッションを止められないため、原因を context に流す
  echo "pnpm install に失敗しました:"
  tail -n 30 "$log"
fi
rm -f "$log"
