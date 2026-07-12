#!/usr/bin/env python3
import json
import sys
from pathlib import Path

# inferred JSON を丸ごと context に載せるとトークンを浪費するので、該当 id の item だけに絞る。
REPO_ROOT = Path(__file__).resolve().parents[4]
INFERRED_DIR = REPO_ROOT / "apps/changelog-fetcher/inferred"


def version_key(v):
    return tuple(int(x) for x in v.split(".") if x.isdigit())


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: extract.py <week.json>")

    week = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))

    # 同じ version を item ごとに開き直さないよう索引をキャッシュする
    cache = {}
    out_items = []
    for sel in week["items"]:
        version = sel["version"]
        if version not in cache:
            path = INFERRED_DIR / f"inferred_v{version}.json"
            if not path.exists():
                sys.exit(f"inferred file not found: {path}")
            data = json.loads(path.read_text(encoding="utf-8"))
            cache[version] = {it["id"]: it for it in data["items"]}

        item = cache[version].get(sel["id"])
        if item is None:
            sys.exit(f"id not found in v{version}: {sel['id']}")

        out_items.append(
            {
                "id": sel["id"],
                "version": version,
                "prefix": item.get("prefix"),
                "content_ja": item.get("content_ja"),
                "comment": sel.get("comment", ""),
                "inference": item.get("inference"),
                "has_snippets": bool(
                    any(d.get("snippets") for d in item.get("related_docs", []))
                ),
            }
        )

    versions = sorted({s["version"] for s in week["items"]}, key=version_key)
    result = {
        "week": week["week"],
        "period_start": week["period_start"],
        "period_end": week["period_end"],
        "version_min": versions[0],
        "version_max": versions[-1],
        "versions": versions,
        "items": out_items,
    }
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
