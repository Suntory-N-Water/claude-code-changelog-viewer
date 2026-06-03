# ADR 0018: notification-worker DDD 実践記録 — Functional DDD スタイルと設計の最終形

## Status

Accepted

## Context

ADR 0016(DDD 採用方針)と ADR 0017(移行時の実装ルール)に基づき、`feature/apply-ddd-notification-worker` ブランチで notification-worker の DDD 移行を完了した。本 ADR は実装を通じて確立した最終的な設計の全体像と、検討・判断した内容を記録する。

### 実装前の課題

- 業務ルール(失敗3回で無効化など)が `routes/` と `queue/consumer.ts` に散在
- `sendToDiscord` 等のインフラ詳細をルート層・キュー層が直接呼んでいた
- ドメイン値の変換(HTTP ステータス→失敗種別など)の責務が曖昧だった
- HTTP レベルの知識(ステータスコード `401` `403` `404` `429` 等)がアプリケーション層まで漏れていた

### 関連 ADR

- ADR 0016: notification-worker への DDD 採用方針(採用背景・レイヤー構成の決定)
- ADR 0017: DDD 移行時の実装ルール(重複解消・薄いラッパー禁止・Result 分岐の方向性)

## Decision

**notification-worker を domain / application / infrastructure / routes の4層に再構成し、Functional DDD スタイルで業務ルールをドメイン層に集約する実装を完了した。**

### 1. 最終的なレイヤー構成

```
apps/notification-worker/src/
  domain/channel/
    channel.ts                  # Channel 集約(discriminated union) + ChannelId VO
    channel-lifecycle.ts        # isActive / deactivate / reactivate（純粋関数）
    channel-failure.ts          # recordFailure / resetFailure（純粋関数）
    channel-repository.ts       # ChannelRepository port インターフェース
    channel-notifier.ts         # ChannelNotifier port インターフェース + NotificationResult
    discord-webhook-url.ts      # 値オブジェクト
    slack-webhook-url.ts        # 値オブジェクト
    email-address.ts            # 値オブジェクト
    notification-frequency.ts   # 値オブジェクト
    channel-token.ts            # 値オブジェクト
  application/
    subscribe.ts                # 購読登録ユースケース
    unsubscribe.ts              # 配信停止ユースケース
    dispatch-changelog-notifications.ts  # changelog 通知配信ユースケース
    prepare-unsubscribe.ts      # 配信停止前準備ユースケース
    cleanup-inactive-channels.ts         # 非アクティブチャンネル削除ユースケース
  infrastructure/
    drizzle/
      channel-repository.ts     # ChannelRepository の Drizzle/D1 実装
      email-crypto.ts           # Email 暗号化・ハッシュ
    notification/
      discord.ts                # Discord API 送信(低レベル)
      slack.ts                  # Slack API 送信(低レベル)
      email.ts                  # Email 送信(低レベル)
      changelog-message.ts      # メッセージ生成の共通部品
    channel-notifier.ts         # ChannelNotifier の Discord/Slack/Email 実装
    turnstile.ts                # Turnstile 検証
  routes/                       # HTTP ハンドラー(エントリーポイント)
  queue/consumer.ts             # Queue コンシューマー(エントリーポイント)
  cron/cleanup.ts               # スケジューラー起動(エントリーポイント)
  db/                           # Drizzle スキーマ定義(変更なし)
```

### 2. Functional DDD スタイルの採用

OOP DDD ではエンティティのクラスメソッドとして振る舞いを表現するが、本プロジェクトでは**純粋関数として振る舞いを分離する Functional DDD スタイル**を採用した。

```ts
// 採用: 純粋関数スタイル
// domain/channel/channel-failure.ts
export function recordFailure(channel: Channel, failedAt: Date): Channel {
  const failed = { ...channel, failCount: channel.failCount + 1 };
  if (failed.failCount < CHANNEL_FAILURE_THRESHOLD) return failed;
  return deactivate(failed, 'system', failedAt);
}

// 不採用: クラスメソッドスタイル
// channel.recordFailure(failedAt)
```

採用理由は ADR 0016 に記載のとおり(Cloudflare Workers + 関数型スタイルとの整合性、テスト容易性、`class` の `this` 束縛回避)。

**ドメインモデル貧血症との違い**

Functional DDD を採用すると「データだけのオブジェクト」に見えるため、ドメインモデル貧血症(業務ルールがドメイン層の外に漏れるアンチパターン)と混同されることがある。区別の基準は「**業務ルールがどの層にあるか**」であり、関数とクラスの違いではない。

| | ドメインモデル貧血症 | 本実装(Functional DDD) |
|---|---|---|
| 業務ルールの場所 | application / service 層に漏れる | `domain/channel/` に閉じている |
| 外から見た Channel | データのみ | データのみ（同じ） |
| `deactivate` の場所 | usecase 内に直接記述 | `domain/channel/channel-lifecycle.ts` |
| `recordFailure` の場所 | queue/consumer.ts 内に直接記述 | `domain/channel/channel-failure.ts` |

ドメイン層の純粋関数に業務ルールが集約されており、アプリケーション層は「呼ぶだけ」に徹している。

### 3. Channel 集約の discriminated union 表現

Channel エンティティは DSC / SLK / EML の3種を discriminated union で1つの型として表現する。DB のスーパータイプ/サブタイプ設計(ADR 0005)と対応しており、型の網羅性チェックを TypeScript のコンパイラが保証する。

```ts
// domain/channel/channel.ts
export type Channel = DiscordChannel | SlackChannel | EmailChannel;

// 生成時の不変条件はファクトリで保証
export function createChannel(
  address: ChannelAddress,
  notificationFrequency: NotificationFrequency,
): Channel {
  const base = {
    id: createChannelId(crypto.randomUUID()),
    token: createChannelToken(crypto.randomUUID()),
    notificationFrequency,
    status: { type: 'active' } as const,
    failCount: 0,
  };
  // ...switch で DSC / SLK / EML を生成
}
```

### 4. NotificationResult による HTTP 知識のインフラ層への隔離

通知の送信結果をアプリケーション層に返す型として `NotificationResult` を定義した。HTTP ステータスコードをそのまま上位層に渡すのではなく、インフラ層がドメインが理解できる概念(失敗の種別)に変換して返す。

```ts
// domain/channel/channel-notifier.ts
// ドメイン port: HTTP の知識を持たない
export type NotificationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failureKind: 'permanent' | 'rate_limit' | 'temporary' };
```

```ts
// infrastructure/channel-notifier.ts
// HTTP ステータス → failureKind の変換をインフラ層に閉じ込める
function toNotificationResult(raw: { ok: boolean; status: number }): NotificationResult {
  if (raw.ok) {
    return { ok: true };
  }
  if (raw.status === 429) {
    return { ok: false, failureKind: 'rate_limit' };
  }
  if (raw.status === 401 || raw.status === 403 || raw.status === 404) {
    return { ok: false, failureKind: 'permanent' };
  }
  return { ok: false, failureKind: 'temporary' };
}
```

```ts
// application/dispatch-changelog-notifications.ts
// アプリケーション層は HTTP ステータスコードを知らない
if (!result.ok && result.failureKind === 'permanent') {
  await repository.save(recordFailure(channel, input.failedAt));
}
```

**この設計のメリット: 外部 API の仕様変更が1箇所の修正で済む**

例えば Discord が仕様変更してレート制限を `429` ではなく `503` で返すようになった場合、アプリケーション層を触る必要がなく、インフラ層の `toNotificationResult()` だけを修正すれば良い。

```ts
// infrastructure/channel-notifier.ts のみ修正
if (raw.status === 429 || raw.status === 503) {  // ← ここだけ直す
  return { ok: false, failureKind: 'rate_limit' };
}

// application 層はそのまま、触らなくていい
if (result.failureKind === 'rate_limit') { ... }
```

Discord / Slack / Email それぞれの HTTP 仕様の差異も同様に `toNotificationResult()` 内に閉じ込められるため、アプリケーション層はどのチャンネルの通知かを意識せずに済む。

### 5. port インターフェースによる依存性逆転

ドメイン層に `ChannelRepository` / `ChannelNotifier` の port インターフェースを置き、infrastructure 層が実装する。アプリケーション層はインターフェースのみに依存するため、Cloudflare の `env` バインディングが routes / queue のエントリーポイント層にのみ存在する。

```
依存の方向:
routes/queue → application → domain ← infrastructure
                                ↑
                 (ChannelRepository, ChannelNotifier インターフェース)
```

```ts
// routes/webhooks.ts（エントリーポイント: env はここだけ触る）
const repository = createChannelRepository(c.env.DB, c.env.EMAIL_ENCRYPTION_KEY);
const notifier = createChannelNotifier(c.env);
const result = await subscribe(repository, notifier, input);
```

### 6. インフラ層の役割と「インフラ」という言葉の意味

DDD における「インフラ層」はネットワーク機器やサーバーといったシステムインフラの意味ではなく、**「ドメインの外側にある全ての技術的な詳細を扱う層」** を指す。DB 接続も外部 API 呼び出しも、ドメインから見れば「自分では知らなくていい技術の話」という点で同じカテゴリに属する。

| ファイル | 技術的詳細の種類 |
|---|---|
| `drizzle/channel-repository.ts` | DB 接続・SQL クエリ |
| `notification/discord.ts` 等 | 外部 API への HTTP リクエスト |
| `channel-notifier.ts` | 外部 API 呼び出しの調整・結果変換 |
| `turnstile.ts` | 外部認証サービスへの HTTP リクエスト |
| `email-crypto.ts` | 暗号化ライブラリの利用 |

これらを「便利関数の置き場」ではなく「**ドメインを外の世界（DB・外部 API・外部サービス）から守るための壁**」として捉えることが重要である。

### 7. テスト構造

DDD 適用後のテスト構造は以下のとおり。

| テスト対象 | 種別 | モック要否 |
|---|---|---|
| ドメイン層の業務ルール | ユニットテスト | 不要(純粋関数) |
| アプリケーション層のユースケース | ユニットテスト | ChannelNotifier をモック |
| インフラ層のリポジトリ | 統合テスト | FakeD1 使用 |
| ルート層(HTTP) | 統合テスト | createChannelNotifier をモック |

## Consequences

### Positive

- 業務ルールが `domain/channel/` に集約され、どこに何があるかが層の名前から明確になった
- ドメイン層が純粋関数のみで構成されるため、DB・HTTP なしでユニットテストが書ける
- `NotificationResult` の `failureKind` により、外部 API の HTTP 仕様変化がインフラ層の修正だけで吸収できる
- 新しい通知チャンネルを追加する際の変更箇所が明確になった(domain → infrastructure → application の順)
- エントリーポイント(routes / queue / cron)が薄くなり、処理の流れを上から読むだけで把握できる

### Negative

- ファイル数が大幅に増加し、初見の把握コストが上がった
  - → ファイル名と概念名が1対1に対応しているため、概念名から検索できる
- `env` バインディングをどこで渡すかをエントリーポイントごとに意識する必要がある
  - → routes/queue/cron のエントリーポイントに「`env` はここだけ触る」というコメントを置く規約で対応

### Risks

- Functional DDD スタイルを維持するためには「業務ルールは必ず `domain/` の純粋関数として実装する」という規約を守り続ける必要がある。規約が守られないと実質的なドメインモデル貧血症になる
  - → ADR 0017 の実装ルールと本 ADR のレイヤー構成を参照規準として維持する

## Notes

### 参考資料

- ADR 0005: Drizzle ORM の導入とスーパータイプ/サブタイプ DB スキーマへの移行
- ADR 0016: notification-worker への DDD 採用方針
- ADR 0017: notification-worker DDD 移行時の実装ルール
