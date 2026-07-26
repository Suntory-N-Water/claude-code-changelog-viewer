#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

# inferred JSON を丸ごと context に載せるとトークンを浪費するので、該当 id の item だけに絞る。
REPO_ROOT = Path(__file__).resolve().parents[4]
INFERRED_DIR = REPO_ROOT / "apps/changelog-fetcher/inferred"
ANALYSIS_DIR = REPO_ROOT / "apps/changelog-fetcher/analysis"


def version_key(v):
    return tuple(int(x) for x in v.split(".") if x.isdigit())


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: extract.py <week.json>")

    week = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))

    # 同じ version を item ごとに開き直さないよう索引をキャッシュする
    inferred_cache = {}
    analysis_cache = {}
    out_items = []
    for sel in week["items"]:
        version = sel["version"]
        if version not in inferred_cache:
            path = INFERRED_DIR / f"inferred_v{version}.json"
            if not path.exists():
                sys.exit(f"inferred file not found: {path}")
            data = json.loads(path.read_text(encoding="utf-8"))
            inferred_cache[version] = {it["id"]: it for it in data["items"]}
        if version not in analysis_cache:
            path = ANALYSIS_DIR / f"analysis_v{version}.json"
            if not path.exists():
                sys.exit(f"analysis file not found: {path}")
            data = json.loads(path.read_text(encoding="utf-8"))
            analysis_cache[version] = {it["id"]: it for it in data["items"]}

        item = inferred_cache[version].get(sel["id"])
        if item is None:
            sys.exit(f"id not found in v{version}: {sel['id']}")

        # snippets は analysis JSON にのみ含まれる(inferred JSON の related_docs は file のみ)
        analysis_item = analysis_cache[version].get(sel["id"])
        has_snippets = bool(
            analysis_item
            and any(d.get("snippets") for d in analysis_item.get("related_docs", []))
        )

        # inferred JSON の content は CHANGELOG の Markdown リスト項目そのままで、
        # 先頭に "- "/"* "/"+ " が残る。skeleton の引用ブロックで `> - ...` にならないよう
        # ここで剥がして、後続処理は content を素の一文として扱えるようにする。
        content = item.get("content")
        if content is not None:
            content = re.sub(r"^[-*+]\s+", "", content)

        out_items.append(
            {
                "id": sel["id"],
                "version": version,
                "prefix": item.get("prefix"),
                "content": content,
                "content_ja": item.get("content_ja"),
                "comment": sel.get("comment", ""),
                "image_url": sel.get("image_url"),
                "links": sel.get("links") or [],
                "inference": item.get("inference"),
                "has_snippets": has_snippets,
            }
        )

    # 古い→新しいバージョンが上から下に流れるよう昇順に揃える(同一バージョン内は入力順を維持)
    out_items.sort(key=lambda it: version_key(it["version"]))

    versions = sorted({s["version"] for s in week["items"]}, key=version_key)
    result = {
        "week": week["week"],
        "period_start": week["period_start"],
        "period_end": week["period_end"],
        "total_items": week["total_items"],
        # frontmatter も本文と同じ昇順に揃える(sorted は安定なので同一 version 内は入力順を維持)
        "selected_items": [
            {
                "id": item["id"],
                "version": item["version"],
                "comment": item.get("comment", ""),
            }
            for item in sorted(week["items"], key=lambda it: version_key(it["version"]))
        ],
        "version_min": versions[0],
        "version_max": versions[-1],
        "versions": versions,
        "items": out_items,
    }
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
