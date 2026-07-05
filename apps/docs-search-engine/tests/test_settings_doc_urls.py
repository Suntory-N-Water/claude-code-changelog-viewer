"""settings_doc_urls.py のテスト。"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from click.testing import CliRunner

from docs_search_engine.search import RelatedDocResult
from docs_search_engine.settings_doc_urls import (
    doc_file_to_url,
    main,
    official_urls_from_results,
    write_official_doc_urls,
)


def test_doc_file_to_url_keeps_subdirectories_and_removes_md_suffix() -> None:
    assert (
        doc_file_to_url("agent-sdk/hooks.md")
        == "https://code.claude.com/docs/en/agent-sdk/hooks"
    )


def test_official_urls_from_results_excludes_generic_docs_and_deduplicates() -> None:
    urls, excluded = official_urls_from_results(
        [
            RelatedDocResult("agent-sdk/overview.md", [], 1),
            RelatedDocResult("features-overview.md", [], 1),
            RelatedDocResult("whats-new/2026-01-01.md", [], 1),
            RelatedDocResult("agent-sdk/hooks.md", [], 1),
            RelatedDocResult("agent-sdk/hooks.md", [], 1),
            RelatedDocResult("settings.md", [], 1),
        ]
    )

    assert urls == [
        "https://code.claude.com/docs/en/agent-sdk/hooks",
        "https://code.claude.com/docs/en/settings",
    ]
    assert excluded == [
        "agent-sdk/overview.md",
        "features-overview.md",
        "whats-new/2026-01-01.md",
    ]


def test_write_official_doc_urls_preserves_existing_doc_snippets_format(
    tmp_path: Path,
) -> None:
    path = tmp_path / "settings_api-key-helper.json"
    path.write_text(
        "{\n"
        '  "key": "apiKeyHelper",\n'
        '  "doc_snippets": ["snippet"],\n'
        '  "fetched_at": "2000-01-01"\n'
        "}\n",
        encoding="utf-8",
    )

    write_official_doc_urls(path, ["https://code.claude.com/docs/en/settings"])

    assert path.read_text(encoding="utf-8") == (
        "{\n"
        '  "key": "apiKeyHelper",\n'
        '  "doc_snippets": ["snippet"],\n'
        '  "official_doc_urls": [\n'
        '    "https://code.claude.com/docs/en/settings"\n'
        "  ],\n"
        '  "fetched_at": "2000-01-01"\n'
        "}\n"
    )


@dataclass
class FakeEngine:
    results: list[list[RelatedDocResult]]

    def search_batch(self, entries: list[str]) -> list[list[RelatedDocResult]]:
        assert entries == ["apiKeyHelper"]
        return self.results


def test_cli_dry_run_does_not_write_and_logs_excluded_files(
    tmp_path: Path, monkeypatch
) -> None:
    settings_dir = tmp_path / "settings"
    docs_dir = tmp_path / "docs"
    settings_dir.mkdir()
    docs_dir.mkdir()
    settings_path = settings_dir / "settings_api-key-helper.json"
    original = {
        "key": "apiKeyHelper",
        "leaf_name": "apiKeyHelper",
        "doc_snippets": ["snippet"],
        "fetched_at": "2000-01-01",
    }
    settings_path.write_text(
        json.dumps(original, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    fake_engine = FakeEngine(
        [
            [
                RelatedDocResult("agent-sdk/overview.md", [], 1),
                RelatedDocResult("settings.md", [], 1),
            ]
        ]
    )
    monkeypatch.setattr(
        "docs_search_engine.settings_doc_urls.DocsSearchEngine",
        lambda _: fake_engine,
    )

    result = CliRunner().invoke(
        main,
        [
            "--dry-run",
            "--settings-dir",
            str(settings_dir),
            "--docs-dir",
            str(docs_dir),
        ],
    )

    assert result.exit_code == 0
    assert "https://code.claude.com/docs/en/settings" in result.output
    assert "除外: agent-sdk/overview.md" in result.output
    assert json.loads(settings_path.read_text(encoding="utf-8")) == original


def test_cli_writes_only_official_doc_urls_after_doc_snippets(
    tmp_path: Path, monkeypatch
) -> None:
    settings_dir = tmp_path / "settings"
    docs_dir = tmp_path / "docs"
    settings_dir.mkdir()
    docs_dir.mkdir()
    settings_path = settings_dir / "settings_api-key-helper.json"
    settings_path.write_text(
        json.dumps(
            {
                "key": "apiKeyHelper",
                "leaf_name": "apiKeyHelper",
                "description_ja": "認証情報を出力するスクリプトへのパスを指定します。",
                "use_case_ja": "- CIで使います。",
                "doc_snippets": ["snippet"],
                "fetched_at": "2000-01-01",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    fake_engine = FakeEngine([[RelatedDocResult("settings.md", [], 1)]])
    monkeypatch.setattr(
        "docs_search_engine.settings_doc_urls.DocsSearchEngine",
        lambda _: fake_engine,
    )

    result = CliRunner().invoke(
        main,
        ["--settings-dir", str(settings_dir), "--docs-dir", str(docs_dir)],
    )

    assert result.exit_code == 0
    updated = json.loads(settings_path.read_text(encoding="utf-8"))
    assert list(updated) == [
        "key",
        "leaf_name",
        "description_ja",
        "use_case_ja",
        "doc_snippets",
        "official_doc_urls",
        "fetched_at",
    ]
    assert updated["official_doc_urls"] == ["https://code.claude.com/docs/en/settings"]
    assert (
        updated["description_ja"]
        == "認証情報を出力するスクリプトへのパスを指定します。"
    )
    assert updated["use_case_ja"] == "- CIで使います。"
    assert updated["fetched_at"] == "2000-01-01"
