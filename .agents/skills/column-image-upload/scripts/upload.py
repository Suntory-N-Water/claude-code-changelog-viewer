#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

# 1枚ずつ書き換えると途中で失敗したときに記事が壊れるので、
# アップロードだけを先に全件終わらせる。1件でも失敗したらここで止める。
REPO_ROOT = Path(__file__).resolve().parents[4]
WORKER_DIR = REPO_ROOT / "apps/worker"
WRANGLER = WORKER_DIR / "node_modules/.bin/wrangler"
BUCKET = "weekly-assets"


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: upload.py <manifest.json>")

    manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    images = manifest["images"]
    if not images:
        sys.exit("アップロード対象がない。scan.py をやり直す")
    if not WRANGLER.exists():
        sys.exit(f"wrangler が見つからない: {WRANGLER}\npnpm install を実行する")

    for index, image in enumerate(images, start=1):
        path = REPO_ROOT / image["file"]
        if not path.is_file():
            sys.exit(f"画像が見つからない: {path}\nscan.py をやり直す")

        # --remote がないと本番の R2 ではなくローカルの miniflare ストレージに書かれる
        result = subprocess.run(
            [
                str(WRANGLER),
                "r2",
                "object",
                "put",
                f"{BUCKET}/{image['key']}",
                "--file",
                str(path),
                "--content-type",
                image["content_type"],
                "--remote",
            ],
            cwd=WORKER_DIR,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            sys.exit(
                f"アップロード失敗 ({index}/{len(images)}): {image['key']}\n"
                f"{result.stdout.strip()}\n{result.stderr.strip()}\n"
                "記事は書き換えていない。原因を解消して upload.py からやり直す"
            )
        print(f"[{index}/{len(images)}] {image['url']}")

    print(f"{len(images)} 件すべてアップロードした。rewrite.py に進む")


if __name__ == "__main__":
    main()
