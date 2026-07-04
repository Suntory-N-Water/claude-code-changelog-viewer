"""Markdown 見出し単位のチャンク分割。"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

EXCLUDED_FILE_NAME = "changelog.md"
FENCE_PATTERN = re.compile(r"^\s*```")
HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.*)$")


@dataclass(frozen=True)
class Chunk:
    file: str
    heading: str
    text: str
    start_line: int


def find_markdown_files(docs_dir: Path) -> list[Path]:
    """docs_dir 配下を再帰的に探索し、changelog.md を除いた .md ファイル一覧を返す。"""
    return sorted(
        path
        for path in docs_dir.rglob("*.md")
        if path.name != EXCLUDED_FILE_NAME
    )


def chunk_file(docs_dir: Path, file_path: Path) -> list[Chunk]:
    """1ファイルを見出し単位のチャンクに分割する。

    コードフェンス(```)の開閉状態を追跡し、フェンス内の行は見出し判定の対象外とする。
    """
    lines = file_path.read_text(encoding="utf-8").splitlines()
    relative_file = file_path.relative_to(docs_dir).as_posix()

    chunks: list[Chunk] = []
    heading = ""
    start_line = 1
    buffer: list[str] = []
    in_fence = False

    def flush() -> None:
        if not buffer:
            return
        text = "\n".join(buffer).strip()
        if text:
            chunks.append(
                Chunk(
                    file=relative_file,
                    heading=heading,
                    text=text,
                    start_line=start_line,
                )
            )

    for line_number, line in enumerate(lines, start=1):
        if FENCE_PATTERN.match(line):
            in_fence = not in_fence
            buffer.append(line)
            continue

        heading_match = None if in_fence else HEADING_PATTERN.match(line)
        if heading_match is not None:
            flush()
            heading = heading_match.group(2).strip()
            start_line = line_number
            buffer = [line]
            continue

        buffer.append(line)

    flush()

    return chunks


def chunk_docs(docs_dir: Path) -> list[Chunk]:
    """docs_dir 配下の全 Markdown ファイルをチャンク化する。"""
    chunks: list[Chunk] = []
    for file_path in find_markdown_files(docs_dir):
        chunks.extend(chunk_file(docs_dir, file_path))
    return chunks
