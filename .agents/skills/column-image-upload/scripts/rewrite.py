#!/usr/bin/env python3
import json
import sys
from html import escape
from pathlib import Path

# 同じファイルを複数箇所で参照していると markdown 記法の文字列一致では区別できないので、
# scan.py が記録した出現位置で置換する。位置がずれていれば記事が編集されたということ。
REPO_ROOT = Path(__file__).resolve().parents[4]


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: rewrite.py <manifest.json>")

    manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    images = manifest["images"]
    if not images:
        sys.exit("書き換え対象がない。scan.py をやり直す")

    missing_alt = [image["key"] for image in images if not image["alt"].strip()]
    if missing_alt:
        sys.exit(
            "alt が空の画像がある。マニフェストの alt を埋めてから実行する:\n"
            + "\n".join(f"  - {key}" for key in missing_alt)
        )

    article = REPO_ROOT / manifest["article"]
    text = article.read_text(encoding="utf-8")
    for image in images:
        found = text[image["start"] : image["end"]]
        if found != image["markdown"]:
            sys.exit(
                f"記事が scan.py 実行後に変更されている ({image['file']}):\n"
                f"  期待: {image['markdown']}\n"
                f"  実際: {found}\n"
                "scan.py からやり直す"
            )

    # 前から置換すると後続のオフセットがずれるので後ろから当てる
    for image in reversed(images):
        tag = (
            f'<img alt="{escape(image["alt"], quote=True)}" src="{image["url"]}"'
            f' width="{image["width"]}" height="{image["height"]}">'
        )
        text = text[: image["start"]] + tag + text[image["end"] :]
    article.write_text(text, encoding="utf-8")
    print(f"書き換えた: {manifest['article']} ({len(images)} 件)")

    for file in dict.fromkeys(image["file"] for image in images):
        (REPO_ROOT / file).unlink(missing_ok=True)
        print(f"削除した: {file}")


if __name__ == "__main__":
    main()
