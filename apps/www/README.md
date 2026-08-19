# www

画面をローカルで確認する手順です。コマンドはリポジトリのルートで実行します。

## A. 本番データ・本番 Worker(既定)

```bash
pnpm run dev
```

既定の取得先は `https://claude-code-log.com` です。

## B. 本番データ・ローカル Worker コード

Worker 側の変更を本番データで確認する場合です。Cloudflare の認証が必要です。

```bash
# ターミナル1
pnpm run dev:worker:remote

# ターミナル2
SITE_DATA_ORIGIN=http://localhost:8787 pnpm run dev
```

## C. シードデータ・完全ローカル(オフライン可)

初回だけ、ローカル D1 にマイグレーションとシードを投入します。

```bash
# 初回のみ
cd apps/worker && pnpm run db:migrate && pnpm run db:seed
```

その後、2つのターミナルで起動します。

```bash
# ターミナル1
pnpm run dev:worker

# ターミナル2
SITE_DATA_ORIGIN=http://localhost:8787 pnpm run dev
```

## シードの再生成(管理者のみ)

`generate-seed.ts` は本番 D1 から条件に合う行を抽出します。Cloudflare の認証が必要なため、管理者だけが実行してください。

```bash
pnpm run worker:generate-seed
```

生成結果は `apps/worker/seed/seed.sql` に出力されます。再生成後は、ローカル D1 に `pnpm run worker:seed` で再投入してください。
