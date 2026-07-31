#!/usr/bin/env python3
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# 執筆中の記事にはローカル画像と公開済み画像が混在する。書き換え対象を機械的に確定し、
# アップロードに必要な情報(キー・Content-Type・寸法)を1回の走査でまとめて返す。
REPO_ROOT = Path(__file__).resolve().parents[4]
IMAGE_PATTERN = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)\)")
FRONTMATTER_PATTERN = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n", re.DOTALL)
SLUG_PATTERN = re.compile(r"^slug:\s*['\"]?([a-z0-9-]+)['\"]?\s*$", re.MULTILINE)
# 拡張子は詐称できるので uploads.ts と同じくマジックバイトで判定する
IMAGE_TYPES = [
    ("png", "image/png", [(0, b"\x89PNG\r\n\x1a\n")]),
    ("jpg", "image/jpeg", [(0, b"\xff\xd8\xff")]),
    ("webp", "image/webp", [(0, b"RIFF"), (8, b"WEBP")]),
]


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: scan.py <article.md>")

    article = Path(sys.argv[1]).resolve()
    if not article.is_file():
        sys.exit(f"article not found: {article}")

    text = article.read_text(encoding="utf-8")
    frontmatter = FRONTMATTER_PATTERN.match(text)
    if frontmatter is None:
        sys.exit(f"frontmatter not found: {article}")
    slug_match = SLUG_PATTERN.search(frontmatter.group(1))
    if slug_match is None:
        sys.exit(f"frontmatter に slug がない: {article}")
    slug = slug_match.group(1)

    # 同一実行内の画像は連番で区別できるので、タイムスタンプは実行時刻で揃える。
    # uploads.ts の toISOString() に合わせて UTC で刻む。
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    images = []
    for match in IMAGE_PATTERN.finditer(text):
        src = match.group(2)
        # http(s):// はアップロード済み、/ 始まりは www の public 配下
        if src.startswith(("http://", "https://", "/")):
            continue

        path = (article.parent / src).resolve()
        if not path.is_file():
            sys.exit(f"画像が見つからない: {src} (記事: {article})")

        head = path.read_bytes()[:16]
        image_type = next(
            (
                (extension, content_type)
                for extension, content_type, signatures in IMAGE_TYPES
                if all(
                    head[offset : offset + len(sig)] == sig for offset, sig in signatures
                )
            ),
            None,
        )
        if image_type is None:
            sys.exit(f"PNG・JPEG・WebP のいずれでもない: {path}")
        extension, content_type = image_type

        # sips は WebP も読める(書き出しのみ非対応)ので3形式ともこれで足りる
        result = subprocess.run(
            ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
            capture_output=True,
            text=True,
        )
        size = dict(re.findall(r"(pixelWidth|pixelHeight):\s*(\d+)", result.stdout))
        if len(size) != 2:
            sys.exit(f"sips で寸法を取得できない: {path}\n{result.stderr.strip()}")

        seq = f"{len(images) + 1:02d}"
        key = f"column/{slug}/{seq}-{stamp}.{extension}"
        images.append(
            {
                "seq": seq,
                "markdown": match.group(0),
                "start": match.start(),
                "end": match.end(),
                "file": str(path.relative_to(REPO_ROOT)),
                "alt": match.group(1),
                "key": key,
                "url": f"https://assets.claude-code-log.com/{key}",
                "content_type": content_type,
                "width": int(size["pixelWidth"]),
                "height": int(size["pixelHeight"]),
            }
        )

    json.dump(
        {
            "article": str(article.relative_to(REPO_ROOT)),
            "slug": slug,
            "images": images,
        },
        sys.stdout,
        ensure_ascii=False,
        indent=2,
    )


if __name__ == "__main__":
    main()
