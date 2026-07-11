"""stdin から JSON を受け取り、関連ドキュメント検索結果を stdout に JSON で返す CLI。

stdin: { "docsDir": "/abs/path/to/docs/en", "entries": ["- Added ...", ...] }
stdout: { "results": [ [ {"file", "snippets", "hitCount"}, ... ], ... ] }

entries と results は配列の位置で対応する(id は持たない)。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from .search import DocsSearchEngine


def main() -> None:
    payload = json.load(sys.stdin)
    docs_dir = Path(payload["docsDir"])
    entries: list[str] = payload["entries"]

    engine = DocsSearchEngine(docs_dir)
    results = engine.search_batch(entries)

    output = {
        "results": [
            [
                {
                    "file": doc.file,
                    "snippets": doc.snippets,
                    "snippetScores": doc.snippet_scores,
                    "hitCount": doc.hit_count,
                }
                for doc in docs
            ]
            for docs in results
        ]
    }
    json.dump(output, sys.stdout)


if __name__ == "__main__":
    main()
