"""settings_*.json に公式ドキュメントURLを付与するCLI。"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import click

from .search import DocsSearchEngine, RelatedDocResult

DOCS_URL_BASE = "https://code.claude.com/docs/en"
EXCLUDED_DOC_FILES = {
    "changelog.md",
    "env-vars.md",
    "features-overview.md",
    "agent-sdk/overview.md",
}
EXCLUDED_DOC_PREFIXES = ("whats-new/",)


def default_repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def is_excluded_doc_file(file: str) -> bool:
    return file in EXCLUDED_DOC_FILES or file.startswith(EXCLUDED_DOC_PREFIXES)


def doc_file_to_url(file: str) -> str:
    return f"{DOCS_URL_BASE}/{file.removesuffix('.md')}"


def official_urls_from_results(
    results: list[RelatedDocResult],
) -> tuple[list[str], list[str]]:
    urls: list[str] = []
    excluded: list[str] = []
    seen = set()
    for result in results:
        if is_excluded_doc_file(result.file):
            excluded.append(result.file)
            continue
        url = doc_file_to_url(result.file)
        if url not in seen:
            seen.add(url)
            urls.append(url)
    return urls, excluded


def load_settings_entries(settings_dir: Path) -> list[tuple[Path, dict[str, Any]]]:
    entries: list[tuple[Path, dict[str, Any]]] = []
    for path in sorted(settings_dir.glob("settings_*.json")):
        with path.open(encoding="utf-8") as file:
            entries.append((path, json.load(file)))
    return entries


def format_official_doc_urls_property(official_doc_urls: list[str]) -> str:
    if not official_doc_urls:
        return '  "official_doc_urls": [],\n'
    lines = ['  "official_doc_urls": [']
    for index, url in enumerate(official_doc_urls):
        suffix = "," if index < len(official_doc_urls) - 1 else ""
        lines.append(f"    {json.dumps(url, ensure_ascii=False)}{suffix}")
    lines.append("  ],")
    return "\n".join(lines) + "\n"


def remove_official_doc_urls_property(text: str) -> str:
    match = re.search(r'^  "official_doc_urls": ', text, flags=re.MULTILINE)
    if match is None:
        return text

    decoder = json.JSONDecoder()
    value_start = match.end()
    _, value_end = decoder.raw_decode(text[value_start:])
    value_end += value_start
    if value_end < len(text) and text[value_end] == ",":
        value_end += 1
    if value_end < len(text) and text[value_end] == "\n":
        value_end += 1
    return text[: match.start()] + text[value_end:]


def write_official_doc_urls(path: Path, official_doc_urls: list[str]) -> None:
    text = remove_official_doc_urls_property(path.read_text(encoding="utf-8"))
    match = re.search(r'^  "doc_snippets": ', text, flags=re.MULTILINE)
    if match is None:
        raise ValueError(f"doc_snippets が見つかりません: {path}")

    decoder = json.JSONDecoder()
    value_start = match.end()
    _, value_end = decoder.raw_decode(text[value_start:])
    value_end += value_start
    line_end = text.find("\n", value_end)
    if line_end == -1:
        raise ValueError(f"doc_snippets 行末が見つかりません: {path}")

    insert_at = line_end + 1
    text = (
        text[:insert_at]
        + format_official_doc_urls_property(official_doc_urls)
        + text[insert_at:]
    )
    path.write_text(text, encoding="utf-8")


def update_settings_doc_urls(
    settings_dir: Path,
    docs_dir: Path,
    dry_run: bool,
    engine: DocsSearchEngine | None = None,
) -> None:
    entries = load_settings_entries(settings_dir)
    search_engine = engine if engine is not None else DocsSearchEngine(docs_dir)
    leaf_names = [
        str(data.get("leaf_name") or data["key"].split(".")[-1]) for _, data in entries
    ]
    search_results = search_engine.search_batch(leaf_names)

    for (path, data), results in zip(entries, search_results, strict=True):
        official_doc_urls, excluded_files = official_urls_from_results(results)
        click.echo(
            f"{path.name}: {data.get('leaf_name', data['key'])} -> "
            f"{official_doc_urls or '[]'}"
        )
        if excluded_files:
            click.echo(f"  除外: {', '.join(excluded_files)}")
        if not dry_run:
            write_official_doc_urls(path, official_doc_urls)


@click.command()
@click.option("--dry-run", is_flag=True, help="JSONを書き換えず候補URLだけ表示する。")
@click.option(
    "--settings-dir",
    type=click.Path(path_type=Path, file_okay=False, dir_okay=True, exists=True),
    default=None,
    help="settings_*.json のディレクトリ。",
)
@click.option(
    "--docs-dir",
    type=click.Path(path_type=Path, file_okay=False, dir_okay=True, exists=True),
    default=None,
    help="Claude Code英語ドキュメントのディレクトリ。",
)
def main(dry_run: bool, settings_dir: Path | None, docs_dir: Path | None) -> None:
    repo_root = default_repo_root()
    update_settings_doc_urls(
        settings_dir=settings_dir
        if settings_dir is not None
        else repo_root / "apps/changelog-fetcher/settings",
        docs_dir=docs_dir
        if docs_dir is not None
        else repo_root / "apps/docs-tracker/docs/en",
        dry_run=dry_run,
    )


if __name__ == "__main__":
    main()
