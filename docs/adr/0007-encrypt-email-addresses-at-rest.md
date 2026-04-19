# ADR 0007: メールアドレスの暗号化保存

## Status

Proposed

## Context

notification-worker はユーザーが登録したメールアドレスに changelog の更新通知を送信する。これまで `email_channels` テーブルの `email_address` カラムにメールアドレスを平文で保存していた。

D1 データベースが侵害された場合、全ユーザーのメールアドレスが漏洩するリスクがある。個人情報保護の観点からも、サービス運用上不要な場面では平文のメールアドレスにアクセスできない状態が望ましい。

### 解決したい課題

- データベース侵害時にメールアドレスが平文で流出するリスクの排除
- 既存の重複チェック（同一メールアドレスの二重登録防止）を暗号化後も維持する必要がある
- 送信時にはメールアドレスを復号できる必要がある（ハッシュのみでは不十分）
- 認証エンドポイント（dispatch route）のタイミング攻撃耐性の不足

### 検討した選択肢

1. AES-GCM による暗号化 + HMAC-SHA256 によるハッシュ（Web Crypto API）
2. libsodium (tweetnacl) による暗号化
3. Cloudflare Workers KV の encryption-at-rest に委ねる（アプリケーション層では平文）

### 各選択肢の評価

| 観点 | AES-GCM + HMAC (Web Crypto) | libsodium | KV encryption-at-rest |
|------|------|------|------|
| 追加依存 | なし（ランタイム組み込み） | npm パッケージ追加 | なし |
| Cloudflare Workers 互換 | Web Crypto API が標準で利用可能 | WASM 読み込みが必要 | D1 では未提供 |
| 重複チェック | HMAC ハッシュで検索可能 | 別途ハッシュ実装が必要 | 平文をそのまま比較 |
| DB 侵害時の保護 | 暗号鍵なしでは復号不可 | 暗号鍵なしでは復号不可 | なし（D1 未対応） |
| 実装の複雑さ | 低い | 中程度 | 低い（保護なし） |
| 鍵ローテーション | アプリ側で対応が必要 | アプリ側で対応が必要 | 不要 |

## Decision

Web Crypto API の AES-GCM と HMAC-SHA256 を使い、メールアドレスを暗号化保存する。

### 1. 暗号化スキーム

`email-crypto.ts` モジュールに以下の 3 関数を実装する。

- `hashEmail(email, secret)` — HMAC-SHA256 で決定論的ハッシュを生成。重複チェックやルックアップに使用
- `encryptEmail(email, secret)` — AES-GCM で暗号化。12 バイトの IV を先頭に連結し Base64 エンコード
- `decryptEmail(encrypted, secret)` — Base64 デコード後、先頭 12 バイトを IV として AES-GCM 復号

```typescript
// ハッシュ: 重複検索用（決定論的）
const hash = await hashEmail("user@example.com", env.EMAIL_ENCRYPTION_KEY);

// 暗号化: 保存用（毎回異なるIV）
const encrypted = await encryptEmail("user@example.com", env.EMAIL_ENCRYPTION_KEY);

// 復号: 送信時
const email = await decryptEmail(encrypted, env.EMAIL_ENCRYPTION_KEY);
```

### 2. データベーススキーマの変更

`email_channels` テーブルの `email_address` カラムを廃止し、`email_hash` と `email_encrypted` の 2 カラムに置き換える。

```
email_channels
├── channel_id     TEXT PK → channels(id)
├── email_hash      TEXT NOT NULL UNIQUE   -- HMAC-SHA256 ハッシュ（検索用）
└── email_encrypted TEXT NOT NULL          -- AES-GCM 暗号文（復号用）
```

SQLite は `ADD COLUMN NOT NULL`（DEFAULT なし）をサポートしないため、マイグレーションではテーブル再作成方式を採用する。

```sql
CREATE TABLE email_channels_new (...);
INSERT INTO email_channels_new ... SELECT ... FROM email_channels;
DROP TABLE email_channels;
ALTER TABLE email_channels_new RENAME TO email_channels;
CREATE UNIQUE INDEX ... ON email_channels (email_hash);
```

### 3. 各ルートへの適用

- 登録時（`webhooks.ts`）: メールアドレスを `hashEmail` / `encryptEmail` してから DB に保存。重複チェックは `email_hash` で行う
- 送信時（`consumer.ts`）: DB から `email_encrypted` を取得し、`decryptEmail` で復号してから送信

### 4. dispatch route のタイミング攻撃対策

Authorization ヘッダの比較を `===` から定数時間比較に変更する。SHA-256 ダイジェストを中間層として使い、`timingSafeEqual` を実装する。

```typescript
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  return va.length === vb.length && va.every((byte, i) => byte === vb[i]);
}
```

### 5. 環境変数の追加

`EMAIL_ENCRYPTION_KEY` を新たな必須環境変数として追加する。AES-GCM の鍵長に合わせ 256 ビット（32 バイト）の文字列を設定する。

### 6. テスト環境の更新

- `fake-d1.ts`: `email_channels` テーブルのスキーマを `email_hash` / `email_encrypted` に更新
- `notification-test-support.ts`: テスト用の `EMAIL_ENCRYPTION_KEY` バインディングを追加
- `bunfig.toml`: テスト preload に `setup.ts` を設定（`cloudflare:email` モジュールのモック）

## Consequences

### Positive

- DB が侵害されても、暗号鍵なしではメールアドレスを復元できない
- HMAC ハッシュにより、暗号化後も重複チェックの性能は変わらない
- Web Crypto API はランタイム組み込みのため追加依存なし
- dispatch route のタイミング攻撃耐性が向上

### Negative

- メール送信のたびに復号処理が必要になる
  - → AES-GCM の復号は高速であり、Worker のリクエスト処理時間への影響は軽微
- `EMAIL_ENCRYPTION_KEY` の漏洩は全メールアドレスの漏洩と同等
  - → Cloudflare Workers の Secrets として管理し、コードベースには含めない
- 鍵ローテーション時に全レコードの再暗号化が必要
  - → 現時点ではユーザー数が限定的であり、運用上の問題は小さい

### Risks

- AES-GCM の鍵サイズが `EMAIL_ENCRYPTION_KEY` の文字列長に依存している（Web Crypto API の `importKey('raw', ...)` は任意長バイト列を受け入れるが、AES-GCM は 128/192/256 ビット鍵を期待する）
  - → 鍵の生成手順をドキュメント化し、32 バイトの鍵を運用ルールとして定める
- マイグレーション時に既存の平文メールアドレスが `email_hash` カラムにそのまま挿入される（`INSERT ... SELECT email_address, '' FROM email_channels`）
  - → 本番適用前にマイグレーションスクリプトまたは手動で既存データの再暗号化が必要

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|------------|------------|
| 鍵ローテーション手順 | 現時点ではユーザー数が少なく運用負荷が低い | ユーザー数 or セキュリティ要件の増加時 |
| 既存データのマイグレーション手順 | 初回デプロイ時に手動対応可能な規模 | 本番デプロイ直前 |
| HMAC の pepper / salt の分離 | 現行は `EMAIL_ENCRYPTION_KEY` を暗号化とハッシュの両方に使用 | セキュリティレビュー時 |

## Notes

### 参考資料

- [Web Crypto API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM - MDN](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)
- [Cloudflare Workers Runtime APIs - Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- ADR 0006: Slack 通知チャンネルの追加
