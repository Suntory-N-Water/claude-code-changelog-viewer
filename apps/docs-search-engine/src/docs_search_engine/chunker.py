"""Markdown 見出し単位のチャンク分割。"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

EXCLUDED_FILE_NAME = "changelog.md"
FENCE_PATTERN = re.compile(r"^\s*```")
HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.*)$")

# 見出し配下の本文が肥大化した場合の二次分割閾値 (文字数)。
# Gemini free tier TPM (250K/min) 対策で snippet を圧縮する必要があり、
# 段落単位マッチ抽出 (search.py) を効かせるためには 1 チャンクが段落数個に
# 収まる程度でなければならないため、経験的に 2000 文字を採用。
SECONDARY_SPLIT_THRESHOLD = 2000


@dataclass(frozen=True)
class Chunk:
    file: str
    heading: str
    text: str
    start_line: int


def find_markdown_files(docs_dir: Path) -> list[Path]:
    """docs_dir 配下を再帰的に探索し、changelog.md を除いた .md ファイル一覧を返す。"""
    return sorted(
        path for path in docs_dir.rglob("*.md") if path.name != EXCLUDED_FILE_NAME
    )


def chunk_file(docs_dir: Path, file_path: Path) -> list[Chunk]:
    """1ファイルを見出し単位のチャンクに分割する。

    コードフェンス(```)の開閉状態を追跡し、フェンス内の行は見出し判定の対象外とする。
    見出し配下が SECONDARY_SPLIT_THRESHOLD を超える場合は段落境界で二次分割する。
    """
    lines = file_path.read_text(encoding="utf-8").splitlines()
    relative_file = file_path.relative_to(docs_dir).as_posix()

    chunks: list[Chunk] = []
    heading = ""
    buffer: list[tuple[int, str]] = []
    in_fence = False

    def flush() -> None:
        if not buffer:
            return
        for start_line, sub_text in _split_buffer(buffer, SECONDARY_SPLIT_THRESHOLD):
            chunks.append(
                Chunk(
                    file=relative_file,
                    heading=heading,
                    text=sub_text,
                    start_line=start_line,
                )
            )

    for line_number, line in enumerate(lines, start=1):
        if FENCE_PATTERN.match(line):
            in_fence = not in_fence
            buffer.append((line_number, line))
            continue

        heading_match = None if in_fence else HEADING_PATTERN.match(line)
        if heading_match is not None:
            flush()
            heading = heading_match.group(2).strip()
            buffer = [(line_number, line)]
            continue

        buffer.append((line_number, line))

    flush()

    return chunks


def _split_buffer(
    buffer: list[tuple[int, str]], threshold: int
) -> list[tuple[int, str]]:
    """buffer を段落境界で分割し、(start_line, text) のリストを返す。

    threshold を超える場合のみ分割。コードフェンス内の空行は分割境界にしない
    (見出し境界の in_fence では二次分割時のフェンス状態を把握できないため、
    ここで buffer 全体を再走査してフェンス状態を判定する)。
    """
    full_text = "\n".join(line for _, line in buffer).strip()
    if not full_text:
        return []

    start_line = buffer[0][0]
    if len(full_text) <= threshold:
        return [(start_line, full_text)]

    segments: list[tuple[int, str]] = []
    current: list[tuple[int, str]] = []
    current_size = 0
    in_fence = False

    def emit() -> None:
        nonlocal current, current_size
        if not current:
            return
        text = "\n".join(line for _, line in current).strip()
        if text:
            segments.append((current[0][0], text))
        current = []
        current_size = 0

    for line_number, line in buffer:
        if FENCE_PATTERN.match(line):
            in_fence = not in_fence
            current.append((line_number, line))
            current_size += len(line) + 1
            continue

        if not in_fence and line.strip() == "" and current_size >= threshold:
            emit()
            continue

        current.append((line_number, line))
        current_size += len(line) + 1

    emit()

    return segments if segments else [(start_line, full_text)]


def chunk_docs(docs_dir: Path) -> list[Chunk]:
    """docs_dir 配下の全 Markdown ファイルをチャンク化する。"""
    chunks: list[Chunk] = []
    for file_path in find_markdown_files(docs_dir):
        chunks.extend(chunk_file(docs_dir, file_path))
    return chunks
