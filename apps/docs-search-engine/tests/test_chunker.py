"""chunker.py のテスト。コードフェンス内の `#` 誤検知回帰を中心に検証する。"""

from __future__ import annotations

from pathlib import Path

from docs_search_engine.chunker import chunk_docs, chunk_file, find_markdown_files

DOCS_DIR = Path(__file__).parent.parent.parent / "docs-tracker" / "docs" / "en"


def test_settings_md_does_not_treat_fenced_comment_as_heading() -> None:
    chunks = chunk_file(DOCS_DIR, DOCS_DIR / "settings.md")

    headings = [chunk.heading for chunk in chunks]

    assert (
        "Replace your-repo-file-index with your own file search command" not in headings
    )


def test_settings_md_fenced_bash_block_kept_in_single_chunk() -> None:
    chunks = chunk_file(DOCS_DIR, DOCS_DIR / "settings.md")

    fenced_chunk = next(
        chunk for chunk in chunks if "your-repo-file-index --query" in chunk.text
    )

    assert (
        "# Replace your-repo-file-index with your own file search command"
        in fenced_chunk.text
    )


def test_monitoring_usage_md_does_not_treat_fenced_comments_as_headings() -> None:
    chunks = chunk_file(DOCS_DIR, DOCS_DIR / "monitoring-usage.md")

    headings = [chunk.heading for chunk in chunks]

    assert "1. Enable telemetry" not in headings
    assert (
        "2. Choose exporters (both are optional - configure only what you need)"
        not in headings
    )


def test_find_markdown_files_excludes_changelog_and_is_recursive() -> None:
    files = find_markdown_files(DOCS_DIR)
    relative_names = {path.relative_to(DOCS_DIR).as_posix() for path in files}

    assert "changelog.md" not in relative_names
    assert any(name.startswith("agent-sdk/") for name in relative_names)
    assert any(name.startswith("whats-new/") for name in relative_names)


def test_chunk_docs_returns_chunks_for_all_discovered_files() -> None:
    chunks = chunk_docs(DOCS_DIR)
    files_with_chunks = {chunk.file for chunk in chunks}
    discovered_files = {
        path.relative_to(DOCS_DIR).as_posix() for path in find_markdown_files(DOCS_DIR)
    }

    assert files_with_chunks <= discovered_files
    assert len(chunks) > 0
