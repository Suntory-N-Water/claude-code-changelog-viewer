#!/usr/bin/env bash
set -euo pipefail

# Git設定(冪等性を保証)
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

# package.jsonのバージョン更新
PACKAGE_JSON="package.json"

if [ ! -f "$PACKAGE_JSON" ]; then
  echo "❌ Error: $PACKAGE_JSON not found"
  exit 1
fi

# vプレフィックスを除去してpackage.jsonに設定
CLEAN_VERSION="${LATEST_VERSION#v}"

# jqを使ってバージョンを更新
if command -v jq >/dev/null 2>&1; then
  TMP_FILE=$(mktemp)
  jq --arg version "$CLEAN_VERSION" '.version = $version' "$PACKAGE_JSON" > "$TMP_FILE"
  mv "$TMP_FILE" "$PACKAGE_JSON"
  echo "✅ Updated $PACKAGE_JSON to version $CLEAN_VERSION"
else
  # jqがない場合はsedで更新(フォールバック)
  sed -i.bak "s/\"version\": \".*\"/\"version\": \"$CLEAN_VERSION\"/" "$PACKAGE_JSON"
  rm -f "${PACKAGE_JSON}.bak"
  echo "✅ Updated $PACKAGE_JSON to version $CLEAN_VERSION (using sed)"
fi

# 変更をステージング
git add "$PACKAGE_JSON"

# Gitタグの作成
if git rev-parse "$LATEST_VERSION" >/dev/null 2>&1; then
  echo "⚠️  Tag $LATEST_VERSION already exists, skipping tag creation"
else
  git tag -a "$LATEST_VERSION" -m "Release $LATEST_VERSION

Synced with Claude Code $LATEST_VERSION"
  echo "✅ Created tag: $LATEST_VERSION"
fi
