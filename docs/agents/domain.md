# Domain Docs

engineering 系 skill がコードベースを調査する際に、このリポジトリのドメインドキュメントをどう読むかを定義する。

## 調査を始める前に読むもの

- リポジトリルートの **`CONTEXT.md`**、または
- ルートに **`CONTEXT-MAP.md`** がある場合はそれ。コンテキストごとの `CONTEXT.md` を指しているので、対象トピックに関係するものをすべて読む。
- **`docs/adr/`** — これから作業する領域に関わる ADR を読む。マルチコンテキスト構成のリポジトリでは `src/<context>/docs/adr/` のコンテキスト固有の決定も確認する。

これらのファイルが存在しない場合は、**何も言わずにそのまま進める**。不在を指摘したり、事前に作成を提案したりしない。`/domain-modeling` skill(`/grill-with-docs` と `/improve-codebase-architecture` から到達する)が、用語や決定が実際に確定した時点で遅延的に作成する。

## ファイル構成

シングルコンテキスト構成(このリポジトリはこちら):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

マルチコンテキスト構成(ルートに `CONTEXT-MAP.md` がある場合):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← システム全体の決定
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← コンテキスト固有の決定
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## 用語集の語彙を使う

出力がドメイン概念を指す場合(issue のタイトル、リファクタリング提案、仮説、テスト名など)、`CONTEXT.md` で定義された用語をそのまま使う。用語集が明示的に避けている同義語に流れない。

必要な概念が用語集にまだ無い場合、それ自体がシグナルである。プロジェクトが使っていない言葉を発明しているか(考え直す)、本当に欠落があるか(`/domain-modeling` 向けに記録する)のどちらかである。

## ADR との矛盾を申告する

出力が既存の ADR と矛盾する場合、黙って上書きせず明示的に指摘する:

> _ADR-0007(event-sourced orders)と矛盾する。ただし次の理由で再検討の価値がある:…_
