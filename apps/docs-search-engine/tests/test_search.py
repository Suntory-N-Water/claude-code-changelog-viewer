"""search.py のテスト。BM25スコア順序・同義語展開・スコア0除外・上位3ファイル集約を検証する。"""

from __future__ import annotations

from pathlib import Path

import pytest

from docs_search_engine import synonyms
from docs_search_engine.search import DocsSearchEngine, load_nlp


@pytest.fixture(scope="module")
def nlp():
    return load_nlp()


def _write_docs(tmp_path: Path, files: dict[str, str]) -> Path:
    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    for name, content in files.items():
        path = docs_dir / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    return docs_dir


def test_search_batch_excludes_zero_score_chunks(tmp_path: Path, nlp) -> None:
    docs_dir = _write_docs(
        tmp_path,
        {
            "hooks.md": "# Hooks\n\nHooks let you run custom commands on events.\n",
        },
    )
    engine = DocsSearchEngine(docs_dir, nlp=nlp)

    results = engine.search_batch(["completely unrelated banana smoothie recipe"])

    assert results == [[]]


def test_search_batch_orders_files_by_score_descending(tmp_path: Path, nlp) -> None:
    docs_dir = _write_docs(
        tmp_path,
        {
            "strong.md": "# Sessions\n\nSession resume session resume session resume behavior explained in detail.\n",
            "weak.md": "# Overview\n\nSession resume handling is mentioned once here.\n",
            "unrelated1.md": "# Billing\n\nInvoices and payment methods are unrelated topics.\n",
            "unrelated2.md": "# Themes\n\nColor schemes and font choices for the editor.\n",
            "unrelated3.md": "# Networking\n\nProxy configuration and firewall rules overview.\n",
        },
    )
    engine = DocsSearchEngine(docs_dir, nlp=nlp, min_file_score=0)

    [results] = engine.search_batch(["How does session resume work?"])

    assert [doc.file for doc in results][:2] == ["strong.md", "weak.md"]


def test_search_batch_limits_to_top_three_files(tmp_path: Path, nlp) -> None:
    files = {
        f"doc{i}.md": f"# Topic {i}\n\n" + "Subagent configuration. " * (5 - i)
        for i in range(5)
    }
    files["unrelated1.md"] = "# Billing\n\nInvoices and payment methods overview.\n"
    files["unrelated2.md"] = "# Themes\n\nColor schemes and font choices overview.\n"
    docs_dir = _write_docs(tmp_path, files)
    engine = DocsSearchEngine(docs_dir, nlp=nlp, min_file_score=0)

    [results] = engine.search_batch(["subagent configuration"])

    assert [doc.file for doc in results] == ["doc0.md", "doc1.md", "doc2.md"]


def test_search_batch_caps_snippets_per_file_at_five(tmp_path: Path, nlp) -> None:
    heading_blocks = "\n\n".join(
        f"## Section {i}\n\nSubagent configuration detail {i}." for i in range(8)
    )
    files = {"doc.md": f"# Subagents\n\n{heading_blocks}\n"}
    files["unrelated1.md"] = "# Billing\n\nInvoices and payment methods overview.\n"
    files["unrelated2.md"] = "# Themes\n\nColor schemes and font choices overview.\n"
    docs_dir = _write_docs(tmp_path, files)
    engine = DocsSearchEngine(docs_dir, nlp=nlp, min_file_score=0)

    [results] = engine.search_batch(["subagent configuration"])

    assert len(results) == 1
    assert len(results[0].snippets) <= 5
    assert results[0].hit_count >= len(results[0].snippets)


def test_search_batch_expands_synonyms_to_find_harness_via_cli_query(
    tmp_path: Path, nlp
) -> None:
    docs_dir = _write_docs(
        tmp_path,
        {
            "cli.md": "# CLI reference\n\nThe CLI supports many flags and options.\n",
            "unrelated1.md": "# Billing\n\nInvoices and payment methods are unrelated topics.\n",
            "unrelated2.md": "# Themes\n\nColor schemes and font choices for the editor.\n",
        },
    )
    engine = DocsSearchEngine(docs_dir, nlp=nlp, min_file_score=0)

    [results] = engine.search_batch(["What does the harness support?"])

    assert results[0].file == "cli.md"


def test_expand_query_adds_missing_counterpart() -> None:
    expanded = synonyms.expand_query("How does the harness behave?")

    assert "cli" in expanded.lower()


def test_expand_query_does_not_duplicate_existing_counterpart() -> None:
    text = "The CLI and harness both refer to the same thing."
    expanded = synonyms.expand_query(text)

    assert expanded == text
