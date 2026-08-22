---
paths:
  - "apps/worker/**/*.ts"
  - "packages/common/src/logger.ts"
---

# ロギング規則

- ドメイン層にログを書かない。
- logger を関数の引数として渡さない。入口で `runWithLogContext` を張り、logger がコンテキストを自動的に付与する。
- `message` は固定文にし、可変値は `attrs` に出す。
