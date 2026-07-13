#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

# LLM に content_ja を一度もタイプさせないため、frontmatter・見出しはこのスクリプトが直接書き出す。
# LLM が埋めるのはプレースホルダ(冒頭ひとこと・各本文・description の要点)だけに限定する。
REPO_ROOT = Path(__file__).resolve().parents[4]
WEEKLY_DIR = REPO_ROOT / "apps/changelog-fetcher/posts/weekly"


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: skeleton.py <extracted.json>")

    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))

    version_min = data["version_min"]
    version_max = data["version_max"]
    version_label = (
        f"v{version_min}"
        if version_min == version_max
        else f"v{version_min}–v{version_max}"
    )
    title = f"Claude Code 週次アップデート ({version_label})"

    def q(value):
        # WeeklyPostStore と同じダブルクォート表現に揃える(YAML の Date 型解釈を避ける)
        return json.dumps(value, ensure_ascii=False)

    sy, sm, sd = (int(x) for x in data["period_start"].split("-"))
    ey, em, ed = (int(x) for x in data["period_end"].split("-"))
    end_str = f"{ey}年{em}月{ed}日" if ey != sy else f"{em}月{ed}日"
    intro_line = (
        f"{sy}年{sm}月{sd}日~{end_str}の変更で、"
        "個人的に気になったものをピックアップしました。"
    )
    # description は「要点(手動で埋める)＋定型文」の半自動方式。
    # 期間は年跨ぎでも両端に年を入れる(intro_line と違い省略しない)。
    period_full = f"{sy}年{sm}月{sd}日〜{ey}年{em}月{ed}日"
    description = (
        f"<!-- desc -->など、{period_full}の Claude Code "
        "アップデートから気になった変更をまとめました。"
    )

    lines = [
        "---",
        f"title: {q(title)}",
        # 定型文＋期間はここで確定。要点部分の <!-- desc --> だけを手順5で埋める。
        f"description: {q(description)}",
        f"date: {q(data['period_end'])}",
        f"period_start: {q(data['period_start'])}",
        f"period_end: {q(data['period_end'])}",
        f"total_items: {data['total_items']}",
        "selected_items:",
        *[
            f"  - id: {q(item['id'])}\n"
            f"    version: {q(item['version'])}\n"
            f"    comment: {q(item['comment'])}"
            for item in data["selected_items"]
        ],
        "versions:",
        *[f"  - {v}" for v in data["versions"]],
        "---",
        "",
        intro_line,
        "",
        "<!-- intro -->",
        "",
    ]
    # items は extract.py で version 昇順・同一 version が連続するよう整列済み。
    # version を ## セクション、content_ja を ### 見出しにしてバージョンごとにまとめる。
    current_version = None
    for item in data["items"]:
        if item["version"] != current_version:
            lines.append(f"## v{item['version']}")
            lines.append("")
            current_version = item["version"]
        lines.append(f"### {item['content_ja']}")
        lines.append("")
        # 英語原文の先頭にある Markdown リストマーカー(- / * / +)を除去する。
        # blockquote 内で `> - ...` になると引用がリスト表示されてしまうため。
        lines.extend(
            f"> {re.sub(r'^[-*+]\\s+', '', line)}" if line else ">"
            for line in item["content"].splitlines()
        )
        lines.append("")
        lines.append("<!-- body -->")
        lines.append("")

    # 締めの定型文と公式 CHANGELOG へのリンク(全記事共通・編集不可)
    lines.extend(
        [
            "---",
            "",
            "最後まで読んでいただきありがとうございました。",
            "今回ピックアップしたのは一部です。全ての変更は公式の CHANGELOG で確認できます。",
            "",
            "https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md",
            "",
        ]
    )

    WEEKLY_DIR.mkdir(parents=True, exist_ok=True)
    out_path = WEEKLY_DIR / f"{data['week']}.md"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(out_path)


if __name__ == "__main__":
    main()
