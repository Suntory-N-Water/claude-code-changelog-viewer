"""chunker.py のテスト。コードフェンス内の `#` 誤検知回帰を中心に検証する。"""

from __future__ import annotations

from pathlib import Path

from docs_search_engine.chunker import (
    SECONDARY_SPLIT_THRESHOLD,
    chunk_docs,
    chunk_file,
    find_markdown_files,
)

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


def _make_docs_dir(tmp_path: Path, files: dict[str, str]) -> Path:
    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    for name, content in files.items():
        (docs_dir / name).write_text(content, encoding="utf-8")
    return docs_dir


def test_large_section_is_split_into_multiple_chunks_by_paragraph(tmp_path: Path) -> None:
    paragraph = ("body paragraph " * 60).strip()
    body = "\n\n".join(paragraph for _ in range(6))
    docs_dir = _make_docs_dir(tmp_path, {"big.md": f"## Overview\n\n{body}\n"})

    chunks = chunk_file(docs_dir, docs_dir / "big.md")

    assert len(chunks) > 1
    assert all(chunk.heading == "Overview" for chunk in chunks)
    assert all(chunk.file == "big.md" for chunk in chunks)


def test_fenced_blank_line_does_not_become_split_boundary(tmp_path: Path) -> None:
    prefix = ("prefix text " * 200).strip()
    fenced_block = "```bash\ncmd start\n\ncmd continue after blank\n```"
    suffix = ("suffix text " * 200).strip()
    body = f"{prefix}\n\n{fenced_block}\n\n{suffix}"
    assert len(body) > SECONDARY_SPLIT_THRESHOLD
    docs_dir = _make_docs_dir(tmp_path, {"fence.md": f"## Section\n\n{body}\n"})

    chunks = chunk_file(docs_dir, docs_dir / "fence.md")

    fenced_chunks = [c for c in chunks if "cmd start" in c.text]
    assert len(fenced_chunks) == 1
    fenced_chunk = fenced_chunks[0]
    assert "cmd start" in fenced_chunk.text
    assert "cmd continue after blank" in fenced_chunk.text


def test_secondary_chunk_start_line_reflects_original_file_line(tmp_path: Path) -> None:
    paragraph = ("body word " * 60).strip()
    body = "\n\n".join(paragraph for _ in range(6))
    docs_dir = _make_docs_dir(tmp_path, {"lines.md": f"## Overview\n\n{body}\n"})

    chunks = chunk_file(docs_dir, docs_dir / "lines.md")

    assert len(chunks) > 1
    line_numbers = [chunk.start_line for chunk in chunks]
    assert line_numbers == sorted(set(line_numbers))
    assert chunks[0].start_line == 1
    for chunk in chunks[1:]:
        assert chunk.start_line > 1
