#!/bin/bash

# 全changelogファイルに対してanalyze→infer:no-aiを実行

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "Starting batch processing..."
echo ""

success_count=0
fail_count=0

for file in changelogs/*.md; do
  version=$(basename "$file" .md)
  echo "Processing $version..."

  if pnpm run analyze "$version" > /dev/null 2>&1 && pnpm run infer:no-ai "$version" -- --no-ai > /dev/null 2>&1; then
    echo "✓ $version"
    ((success_count++))
  else
    echo "✗ $version failed"
    ((fail_count++))
  fi
done

echo ""
echo "=== Summary ==="
echo "Success: $success_count"
echo "Failed: $fail_count"
echo "Total: $((success_count + fail_count))"
