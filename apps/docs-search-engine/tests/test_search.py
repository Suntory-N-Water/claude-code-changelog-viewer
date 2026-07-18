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


def test_search_batch_caps_snippets_per_file_at_three(tmp_path: Path, nlp) -> None:
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
    assert len(results[0].snippets) <= 3
    assert results[0].hit_count >= len(results[0].snippets)


def test_search_batch_drops_snippets_below_min_file_score(tmp_path: Path, nlp) -> None:
    strong_section = "## Section strong\n\n" + "Subagent configuration. " * 20
    weak_section = "## Section weak\n\nSubagent configuration mentioned briefly."
    docs_dir = _write_docs(
        tmp_path,
        {
            "doc.md": f"# Subagents\n\n{strong_section}\n\n{weak_section}\n",
            "unrelated1.md": "# Billing\n\nInvoices and payment methods overview.\n",
            "unrelated2.md": "# Themes\n\nColor schemes and font choices overview.\n",
        },
    )
    unfiltered = DocsSearchEngine(docs_dir, nlp=nlp, min_file_score=0)
    [baseline] = unfiltered.search_batch(["subagent configuration"])
    assert len(baseline[0].snippet_scores) >= 2
    # 最上位と 2 番目の中間で足切りすれば、最上位のみ残るはず
    cutoff = (baseline[0].snippet_scores[0] + baseline[0].snippet_scores[1]) / 2

    filtered = DocsSearchEngine(docs_dir, nlp=nlp, min_file_score=cutoff)
    [results] = filtered.search_batch(["subagent configuration"])

    assert len(results) == 1
    assert all(score >= cutoff for score in results[0].snippet_scores)
    assert len(results[0].snippet_scores) < len(baseline[0].snippet_scores)


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


def test_snippet_keeps_lead_paragraph_and_high_density_paragraph(
    tmp_path: Path, nlp
) -> None:
    lead = "This section covers the subagent feature and its overall configuration."
    filler_1 = "General billing rules apply for invoices raised each month."
    filler_2 = "Theme customization uses color tokens defined in a separate file."
    match = (
        "Subagent configuration subagent configuration subagent configuration options "
        "are described here in detail with subagent configuration examples."
    )
    filler_3 = "Network proxy settings apply during outbound requests."
    body = "\n\n".join([lead, filler_1, filler_2, match, filler_3])
    docs_dir = _write_docs(
        tmp_path,
        {
            "doc.md": f"# Subagents\n\n{body}\n",
            "unrelated1.md": "# Billing\n\nInvoices and payment methods overview.\n",
            "unrelated2.md": "# Themes\n\nColor schemes and font choices overview.\n",
        },
    )
    engine = DocsSearchEngine(docs_dir, nlp=nlp, min_file_score=0)

    [results] = engine.search_batch(["subagent configuration"])

    assert len(results) == 1
    snippet = results[0].snippets[0]
    assert "This section covers" in snippet
    assert "Subagent configuration subagent configuration" in snippet
    assert "Theme customization" not in snippet
    assert "Network proxy" not in snippet


def test_snippet_matches_query_lemma_across_inflection(tmp_path: Path, nlp) -> None:
    lead = "This document is about runtime behavior."
    filler = "General billing overview lives in another handbook."
    matching = "When the process is running, it emits telemetry after every step."
    tail = "Theme color choices are unrelated to runtime concerns."
    body = "\n\n".join([lead, filler, matching, tail])
    docs_dir = _write_docs(
        tmp_path,
        {
            "runtime.md": f"# Runtime\n\n{body}\n",
            "unrelated1.md": "# Billing\n\nInvoices and payment methods overview.\n",
            "unrelated2.md": "# Themes\n\nColor schemes and font choices overview.\n",
        },
    )
    engine = DocsSearchEngine(docs_dir, nlp=nlp, min_file_score=0)

    [results] = engine.search_batch(["how does the process run telemetry?"])

    assert results[0].file == "runtime.md"
    snippet = results[0].snippets[0]
    assert "running, it emits telemetry" in snippet


def test_short_chunk_returns_full_text_as_snippet(tmp_path: Path, nlp) -> None:
    docs_dir = _write_docs(
        tmp_path,
        {
            "small.md": "# Small\n\nSubagent configuration is short.\n",
            "unrelated1.md": "# Billing\n\nInvoices and payment methods overview.\n",
            "unrelated2.md": "# Themes\n\nColor schemes and font choices overview.\n",
        },
    )
    engine = DocsSearchEngine(docs_dir, nlp=nlp, min_file_score=0)

    [results] = engine.search_batch(["subagent configuration"])

    assert results[0].snippets[0].startswith("# Small")
    assert "Subagent configuration is short." in results[0].snippets[0]
