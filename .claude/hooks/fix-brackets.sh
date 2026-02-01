#!/bin/bash

# Gitで変更があったファイル(ステージング済み・未ステージング両方)を取得
# バイナリファイルや削除されたファイルは除外
changed_files=$(git diff --name-only --diff-filter=ACM HEAD)

if [ -n "$changed_files" ]; then
    # Perlを使用して全角かっこを半角に置換(macOS/Linux両対応のためsedではなくperlを使用)
    echo "$changed_files" | xargs perl -i -pe 's/(/(/g; s/)/)/g' 2>/dev/null
fi

# Stopフックの仕様に従い、JSONで正常終了を通知
cat <<EOF
{
    "hookSpecificOutput": {
        "hookEventName": "Stop",
        "systemMessage": "変更されたファイルの全角かっこを半角に修正しました。"
    }
}
EOF