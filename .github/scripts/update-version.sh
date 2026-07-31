#!/usr/bin/env bash
set -euo pipefail

# Git設定
git config user.name "github-actions[bot]" || true
git config user.email "github-actions[bot]@users.noreply.github.com" || true

# 引数チェック
if [ $# -eq 0 ]; then
  echo "❌ Error: No versions provided"
  echo "Usage: $0 v1.2.3 [v1.2.4 ...]"
  exit 1
fi

VERSIONS=("$@")

# セマンティックバージョニングで最新バージョンを選択
# vプレフィックスを除去してソート
select_latest_version() {
  local versions=("$@")
  local latest=""

  for version in "${versions[@]}"; do
    # vプレフィックスを除去
    local clean_version="${version#v}"

    if [ -z "$latest" ]; then
      latest="$version"
      continue
    fi

    local clean_latest="${latest#v}"

    # バージョン比較 (単純な文字列比較ではなくセマンティックバージョニング)
    if printf '%s\n' "$clean_version" "$clean_latest" | sort -V | tail -n1 | grep -q "^${clean_version}$"; then
      latest="$version"
    fi
  done

  echo "$latest"
}

LATEST_VERSION=$(select_latest_version "${VERSIONS[@]}")

echo "📦 Versions detected: ${VERSIONS[*]}"
echo "🎯 Latest version selected: $LATEST_VERSION"

# claude-version.json の更新
CLAUDE_VERSION_JSON="claude-version.json"

if [ ! -f "$CLAUDE_VERSION_JSON" ]; then
  echo "❌ Error: $CLAUDE_VERSION_JSON not found"
  exit 1
fi

TMP_FILE=$(mktemp)
jq --arg version "$LATEST_VERSION" '.version = $version' "$CLAUDE_VERSION_JSON" > "$TMP_FILE"
mv "$TMP_FILE" "$CLAUDE_VERSION_JSON"
echo "✅ Updated $CLAUDE_VERSION_JSON to version $LATEST_VERSION"

# 変更をステージング
git add "$CLAUDE_VERSION_JSON"
