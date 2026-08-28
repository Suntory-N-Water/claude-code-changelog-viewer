#!/usr/bin/env python3
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

# changelog の正データは D1 にあり、読み取りは Worker の site-data API 経由に限る。
# 全 changelog を丸ごと context に載せるとトークンを浪費するので、該当 id の item だけに絞る。
SITE_DATA_ORIGIN = os.environ.get("SITE_DATA_ORIGIN", "https://claude-code-log.com")
CHANGELOG_PATH = "/api/site-data/changelog"
# 全バージョン(実測 4MB 弱)を1リクエストで受けるため、既定より長めに取る
FETCH_TIMEOUT_SECONDS = 120
# 既定の User-Agent(Python-urllib/x.y)は Cloudflare の bot 判定で 403 になるため明示する
USER_AGENT = "weekly-post-extract/1.0 (+https://claude-code-log.com)"


def version_key(v):
    return tuple(int(x) for x in v.split(".") if x.isdigit())


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: extract.py <week.json>")

    week = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))

    url = f"{SITE_DATA_ORIGIN.rstrip('/')}{CHANGELOG_PATH}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
            changelog = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as error:
        sys.exit(f"changelog の取得に失敗しました ({url}): {error}")

    # API は全バージョンを返すので、id 引きできる形に一度だけ畳む
    items_by_version = {
        version["version"]: {item["id"]: item for item in version["items"]}
        for version in changelog["versions"]
    }

    out_items = []
    for sel in week["items"]:
        version = sel["version"]
        items = items_by_version.get(version)
        if items is None:
            sys.exit(f"version not found in changelog API: v{version}")

        item = items.get(sel["id"])
        if item is None:
            sys.exit(f"id not found in v{version}: {sel['id']}")

        # content は CHANGELOG の Markdown リスト項目そのままで、先頭に "- "/"* "/"+ " が残る。
        # skeleton の引用ブロックで `> - ...` にならないようここで剥がして、
        # 後続処理は content を素の一文として扱えるようにする。
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
