#!/usr/bin/env python3
import json
import sys
from pathlib import Path

# analysis JSON は 30KB 級で全件読むとトークンを浪費するので、該当 id の snippets だけに絞る。
REPO_ROOT = Path(__file__).resolve().parents[4]
ANALYSIS_DIR = REPO_ROOT / "apps/changelog-fetcher/analysis"


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: snippets.py <version> <id>")

    version, item_id = sys.argv[1], sys.argv[2]
    path = ANALYSIS_DIR / f"analysis_v{version}.json"
    if not path.exists():
        sys.exit(f"analysis file not found: {path}")

    data = json.loads(path.read_text(encoding="utf-8"))
    item = next((it for it in data["items"] if it["id"] == item_id), None)
    if item is None:
        sys.exit(f"id not found in v{version}: {item_id}")

    docs = [
        {"file": d.get("file"), "snippets": d["snippets"]}
        for d in item.get("related_docs", [])
        if d.get("snippets")
    ]
    json.dump({"id": item_id, "version": version, "related_docs": docs},
              sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
