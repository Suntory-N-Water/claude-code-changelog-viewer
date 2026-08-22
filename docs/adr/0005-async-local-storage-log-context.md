# AsyncLocalStorage でログのトレースコンテキストを伝播する

## Context

HTTP リクエスト、cron、Queue メッセージ、Workflow の 1 実行に属するログを同じ ID で追跡する必要がある。worker は入口から複数の usecase・infrastructure を非同期に呼び出すため、logger を各関数の引数として渡すとシグネチャが汚染され、ドメイン層にもロギングの関心が漏れる。

## Decision

`packages/common/src/logger.ts` が `AsyncLocalStorage` にログコンテキストを保持する。入口で `runWithLogContext(attrs, fn)` を呼び、logger は出力時に現在のコンテキストを属性へマージする。

logger を引数で渡す案は採用しない。logger の受け渡しは domain / usecase / infrastructure の依存方向を変え、呼び出し元ごとの引数変更を要求する。一方、AsyncLocalStorage は既存の関数シグネチャを変えずに、`await` をまたぐ同一実行のコンテキストを保持できる。

Workflow は step 再開時に `run()` が再実行されるため、`run()` の冒頭で `event.instanceId` を使って毎回コンテキストを張る。cron の task は `runCron` の引数評価より内側で呼び出し、cron 本体のログにもコンテキストを付ける。

## Consequences

- ログの `trace_id` と入口固有の属性を共通処理で付与できる。
- Cloudflare Workers では `nodejs_compat` を前提に `node:async_hooks` を利用する。
- logger を引数に追加する必要がなく、ドメイン層はロギングを持たない。
