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

# claude-version.json の更新
CLAUDE_VERSION_JSON="claude-version.json"

if [ ! -f "$CLAUDE_VERSION_JSON" ]; then
  echo "❌ Error: $CLAUDE_VERSION_JSON not found"
  exit 1
fi

# vプレフィックスを除去して設定
CLEAN_VERSION="${LATEST_VERSION#v}"

TMP_FILE=$(mktemp)
jq --arg version "$CLEAN_VERSION" '.version = $version' "$CLAUDE_VERSION_JSON" > "$TMP_FILE"
mv "$TMP_FILE" "$CLAUDE_VERSION_JSON"
echo "✅ Updated $CLAUDE_VERSION_JSON to version $CLEAN_VERSION"

# 変更をステージング
git add "$CLAUDE_VERSION_JSON"

# Gitタグの作成(既存タグがある場合は上書き)
CLAUDE_TAG="claude-${LATEST_VERSION}"

if git rev-parse "$CLAUDE_TAG" >/dev/null 2>&1; then
  echo "⚠️  Tag $CLAUDE_TAG already exists, overwriting..."
  git tag -d "$CLAUDE_TAG"
fi

git tag -a "$CLAUDE_TAG" -m "Claude Code $LATEST_VERSION

Synced with Claude Code $LATEST_VERSION"
echo "✅ Created tag: $CLAUDE_TAG"

# アプリバージョンタグの作成
APP_VERSION=$(jq -r '.version' package.json)
APP_TAG="app-v${APP_VERSION}"

if git rev-parse "$APP_TAG" >/dev/null 2>&1; then
  echo "ℹ️  App tag $APP_TAG already exists, skipping..."
else
  git tag -a "$APP_TAG" -m "App v${APP_VERSION}

Application version at time of Claude Code $LATEST_VERSION sync"
  echo "✅ Created tag: $APP_TAG"
fi
