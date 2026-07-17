"""BM25 による関連ドキュメント検索。"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import spacy
from rank_bm25 import BM25Okapi
from spacy.language import Language
from spacy.tokens import Doc

from . import synonyms
from .chunker import Chunk, chunk_docs

MAX_FILES = 3
MAX_SNIPPETS_PER_FILE = 3
# 初期キャリブレーション: v2.1.205-207 の 222 件を目視判定した結果、
# max < 18 のファイルは 31 件中 30 件がノイズだった (関連ありは 1 件のみ)。
# その後 v2.1.212 で infer-benefits の入力が Gemini 無料枠 TPM
# (250,000 tokens/min) を超えたため、payload を落とす目的で 25 に引き上げた。
# スニペット単位でも同じ閾値を適用しないと、ファイル max が通ったときに
# 低スコアのスニペットが残り、infer-benefits の入力が肥大化する
MIN_FILE_SCORE = 25


@dataclass(frozen=True)
class RelatedDocResult:
    file: str
    snippets: list[str]
    snippet_scores: list[float]
    hit_count: int


def load_nlp() -> Language:
    return spacy.load("en_core_web_sm", disable=["parser", "ner"])


def tokenize(doc: Doc) -> list[str]:
    return [
        token.lemma_.lower()
        for token in doc
        if not token.is_stop
        and not token.is_punct
        and not token.is_space
        and token.lemma_.strip()
    ]


class DocsSearchEngine:
    def __init__(
        self,
        docs_dir: Path,
        nlp: Language | None = None,
        *,
        min_file_score: float = MIN_FILE_SCORE,
    ) -> None:
        self._nlp = nlp if nlp is not None else load_nlp()
        self._min_file_score = min_file_score
        self._chunks: list[Chunk] = chunk_docs(docs_dir)
        tokenized_chunks = [
            tokenize(doc) for doc in self._nlp.pipe(c.text for c in self._chunks)
        ]
        self._bm25 = BM25Okapi(tokenized_chunks) if tokenized_chunks else None

    def search_batch(self, entries: list[str]) -> list[list[RelatedDocResult]]:
        expanded_entries = [synonyms.expand_query(entry) for entry in entries]
        return [
            self._search_one(tokenize(doc)) for doc in self._nlp.pipe(expanded_entries)
        ]

    def _search_one(self, query_tokens: list[str]) -> list[RelatedDocResult]:
        if self._bm25 is None or not query_tokens:
            return []

        scores = self._bm25.get_scores(query_tokens)

        hits_by_file: dict[str, list[tuple[float, int]]] = defaultdict(list)
        for index, score in enumerate(scores):
            if score > 0:
                hits_by_file[self._chunks[index].file].append((score, index))

        top_files = sorted(
            (
                file
                for file in hits_by_file
                if max(score for score, _ in hits_by_file[file]) >= self._min_file_score
            ),
            key=lambda file: max(score for score, _ in hits_by_file[file]),
            reverse=True,
        )[:MAX_FILES]

        results = []
        for file in top_files:
            hits = sorted(hits_by_file[file], key=lambda hit: hit[0], reverse=True)
            qualifying_hits = [hit for hit in hits if hit[0] >= self._min_file_score]
            top_hits = qualifying_hits[:MAX_SNIPPETS_PER_FILE]
            snippets = [self._chunks[index].text for _, index in top_hits]
            snippet_scores = [round(score, 4) for score, _ in top_hits]
            results.append(
                RelatedDocResult(
                    file=file,
                    snippets=snippets,
                    snippet_scores=snippet_scores,
                    hit_count=len(hits),
                )
            )
        return results
