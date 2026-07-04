"""ドメイン同義語辞書によるクエリ展開。

実データ(#517/#129)で確認された言い換えのみを対象とする。網羅は目指さず、
新たな見逃し・誤ヒットの実例が見つかるたびに追記する。
"""

from __future__ import annotations

# (a, b) の順序に意味はない。どちらか一方が含まれていればもう一方を補う。
SYNONYM_PAIRS: list[tuple[str, str]] = [
    ("session", "conversation"),
    ("harness", "cli"),
    ("hook", "hooks"),
    ("subagent", "sub-agent"),
    ("mcp", "model context protocol"),
    ("headless", "non-interactive"),
    ("slash command", "custom command"),
]


def expand_query(text: str) -> str:
    """text に含まれる同義語のもう片方を末尾に補ったクエリ文字列を返す。"""
    lowered = text.lower()
    additions = [
        counterpart
        for term, counterpart in _iter_pairs_both_directions()
        if term in lowered and counterpart not in lowered
    ]

    if not additions:
        return text

    return " ".join([text, *additions])


def _iter_pairs_both_directions() -> list[tuple[str, str]]:
    return [pair for a, b in SYNONYM_PAIRS for pair in ((a, b), (b, a))]
