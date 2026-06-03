# ADR 0016: notification-worker への DDD 適用方針

## Status

Proposed

## Context

notification-worker は Cloudflare Workers + Hono で動作する通知配信サービスである。現在のコード構成は `routes/` `lib/` `db/` という技術的な分類に基づいており、以下の課題がある。

- 業務ルール(失敗3回で無効化、重複登録チェック、再有効化など)が `routes/webhooks.ts` と `queue/consumer.ts` に散在しており、どこに何の判断ロジックがあるか把握しにくい
- DSC/SLK/EML の3チャンネルに対して同じパターンのコードが重複しており、AI 支援開発でさらに重複が増えやすい構造になっている
- テストが HTTP ハンドラーレベルの統合テストしかなく、業務ルール単体のテストが書けない
- 機能追加時に「このロジックはどこに追加すべきか」の判断基準がない

DDD(ドメイン駆動設計)を適用し、業務ロジックの置き場を明確にする。目的はコード品質の改善だけでなく、DDD の概念と実践の習得も兼ねる。

## Decision

**notification-worker のコードを domain / application / infrastructure / routes の4層に再構成し、業務ルールをドメイン層に集約する。**

### 1. レイヤー構成

```
apps/notification-worker/src/
  domain/
    channel/
      channel.ts                  # 型定義(エンティティ・値オブジェクト)
      channel-lifecycle.ts        # activate / deactivate / reactivate
      channel-failure.ts          # recordFailure(失敗カウント・無効化判定)
      channel-repository.ts       # リポジトリインターフェース
      channel-notifier.ts         # 外部通知の port インターフェース
      discord-webhook-url.ts      # 値オブジェクト
      slack-webhook-url.ts        # 値オブジェクト
      email-address.ts            # 値オブジェクト
      notification-frequency.ts   # 値オブジェクト
      channel-token.ts            # 値オブジェクト
  application/
    subscribe.ts                  # チャンネル登録ユースケース
    unsubscribe.ts                # 配信停止ユースケース
    notify-changelog.ts           # 通知配信ユースケース
    cleanup-inactive-channels.ts  # 非アクティブチャンネル削除ユースケース
  infrastructure/
    drizzle/
      channel-repository.ts       # ChannelRepository の Drizzle/D1 実装
    channel-notifier.ts           # ChannelNotifier の Discord/Slack/Email 実装
    discord.ts                    # Discord API 送信(低レベル)
    slack.ts                      # Slack API 送信(低レベル)
    email.ts                      # メール送信(低レベル)
  routes/                         # エントリーポイント(Hono ハンドラー)
    webhooks.ts
    dispatch.ts
    unsubscribe.ts
  cron/
    cleanup.ts                    # エントリーポイント(スケジューラーからの起動のみ)
  db/
    schema.ts                     # Drizzle スキーマ定義(変更なし)
    constants.ts
```

各層の責務：

| 層 | 責務 | 禁止事項 |
|---|---|---|
| `domain/` | 業務ルールと型定義 | DB・HTTP・外部 API の知識を持たない |
| `application/` | ユースケースの進行管理 | 業務ルールを直接書かない |
| `infrastructure/` | DB・外部 API の実装 | 業務ルールを持たない |
| `routes/` | リクエストのパースとレスポンスの返却 | 業務ルール・DB 操作を直接書かない |

### 2. `Channel` 集約

`Channel` を集約ルートとし、`NotificationSettings`(通知頻度設定)を集約内部に含める。

集約境界の判断根拠: `NotificationSettings` は `Channel` なしに単独で存在できない(DB上も FK 制約)。したがって `Channel` 集約の一部として扱い、リポジトリは両テーブルをまとめて永続化する。

`Channel` エンティティ(DSC/SLK/EML)は discriminated union で1つの型として表現する。`notificationFrequency` は `notification_settings` テーブルの内容を吸収したフィールド。

```ts
// domain/channel/channel.ts
type DiscordChannel = {
  readonly id: ChannelId
  readonly type: 'DSC'
  readonly webhookUrl: DiscordWebhookUrl
  readonly token: ChannelToken
  failCount: number
  status: ChannelStatus
  notificationFrequency: NotificationFrequency  // ← notification_settings を吸収
}

type SlackChannel = { ... }
type EmailChannel = { ... }

type Channel = DiscordChannel | SlackChannel | EmailChannel
```

### 3. 値オブジェクト

現在 `lib/validation.ts` にある正規表現ベースの検証関数をドメイン層の値オブジェクトに置き換える。`lib/validation.ts` は削除し、`domain/channel/` 配下に値オブジェクトごとのファイルを新規作成する。

各ファイルは「型定義」と「ガード節付きの生成関数」をセットで持つ。生成関数が不正な値をはじくことで、ドメイン内に異常な値が存在しないことを保証する。

```ts
// domain/channel/discord-webhook-url.ts
// 「Discord 通知先」という概念を持つ値オブジェクト

declare const discordWebhookUrlBrand: unique symbol;
export type DiscordWebhookUrl = string & { [discordWebhookUrlBrand]: unknown };

const DISCORD_WEBHOOK_REGEX =
  /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function createDiscordWebhookUrl(value: string): DiscordWebhookUrl {
  if (!DISCORD_WEBHOOK_REGEX.test(value)) {
    throw new Error('Discord Webhook URL の形式が不正です');
  }
  return value as DiscordWebhookUrl;
}
```

同様に、以下のファイルをそれぞれ作成する：

| ファイル | 値オブジェクト | 移行元 |
|---|---|---|
| `discord-webhook-url.ts` | `DiscordWebhookUrl` | `lib/validation.ts` の `isValidDiscordWebhookUrl` |
| `slack-webhook-url.ts` | `SlackWebhookUrl` | `lib/validation.ts` の `isValidSlackWebhookUrl` |
| `email-address.ts` | `EmailAddress` | `lib/validation.ts` の `isValidEmail` |
| `notification-frequency.ts` | `NotificationFrequency` | スキーマの型のみ(`'IMM' \| 'WEK'`) |
| `channel-token.ts` | `ChannelToken` | 型定義なし |

### 4. Functional DDD によるエンティティの振る舞い表現

エンティティの振る舞いは**Functional DDD スタイル**(純粋関数として分離)で実装する。

OOP DDDでは `channel.deactivate()` のようにクラスのメソッドに振る舞いを持たせるが、このプロジェクトでは以下の理由から採用しない：
- `class` の `this` 束縛や継承はこのコードベースのスタイルと合わない
- Cloudflare Workers + 関数型スタイルとの整合性
- 純粋関数はテストが書きやすく、副作用がない

Functional DDD では「エンティティ(データ)」と「振る舞い(関数)」を意図的に分離し、関数がエンティティを引数に取って新しいエンティティを返す。これはドメインモデル貧血症(業務ルールをアプリケーション層に書いてしまうアンチパターン)とは異なり、業務ルールはドメイン層の関数として正しく集約される。

```ts
// このプロジェクトで採用: 純粋関数スタイル
function deactivate(channel: Channel, reason: 'user' | 'system'): Channel { ... }

// 採用しない: クラスのメソッドスタイル
// channel.deactivate('user')
```

### 5. 業務ルールのドメイン層への集約

現在 `routes/` と `queue/consumer.ts` に散在している業務ルールをドメイン層に移動する。

```ts
// domain/channel/channel-failure.ts
// 「送信失敗を記録し、閾値超過で無効化する」という業務ルール
function recordFailure(channel: Channel): Channel { ... }

// domain/channel/channel-lifecycle.ts
// 「配信停止する」「再有効化する」という業務ルール
function deactivate(channel: Channel, reason: 'user' | 'system'): Channel { ... }
function reactivate(channel: Channel): Channel { ... }
```

### 6. アプリケーション層(ユースケース)

処理の進行管理に徹し、業務ルールはドメイン層に委譲する。

```ts
// application/subscribe.ts
export async function subscribe(
  repo: ChannelRepository,
  notifier: ChannelNotifier,
  input: SubscribeInput,
): Promise<SubscribeResult> {
  // 進行管理のみ。業務ルールの判断はドメイン層に任せる
  const existing = await repo.findByAddress(input.address);
  if (existing && isActive(existing)) return { error: 'already_registered' };
  // ...
  await notifier.sendTestNotification(channel, unsubscribeUrl);
  // ...
}
```

### 7. Cloudflare Workers 固有の制約への対応

`env.DB` はリクエスト時にしか取得できないため、リポジトリと notifier はリクエストごとにインスタンス化し、アプリケーション層に渡す。これにより、アプリケーション層は Cloudflare の `env` に依存しない。

```ts
// routes/webhooks.ts(エントリーポイント)
export const webhooksRoute = new Hono<...>().post('/', async (c) => {
  const repo = createChannelRepository(c.env.DB);  // ← env はここだけ触る
  const notifier = createChannelNotifier(c.env);   // ← env はここだけ触る
  const result = await subscribe(repo, notifier, input);
  // ...
});
```

### 8. リポジトリインターフェース

インターフェースをドメイン層に置くことで、ドメイン層がインフラ層に依存しない構造を保証する(依存性逆転の原則)。biome.jsonc の `useConsistentTypeDefinitions` ルールに従い `type` で定義する。

```ts
// domain/channel/channel-repository.ts

// チャンネルの通知先アドレスを表す discriminated union
// リポジトリ実装側が address.type で分岐してクエリ対象テーブルを決定できる
type ChannelAddress =
  | { type: 'DSC'; value: DiscordWebhookUrl }
  | { type: 'SLK'; value: SlackWebhookUrl }
  | { type: 'EML'; value: EmailAddress }

type ChannelRepository = {
  findById(id: ChannelId): Promise<Channel | null>
  findByAddress(address: ChannelAddress): Promise<Channel | null>
  save(channel: Channel): Promise<void>
  findActiveByFrequency(frequency: NotificationFrequency): Promise<Channel[]>
  findDeactivatedBefore(date: Date): Promise<Channel[]>
  delete(id: ChannelId): Promise<void>
}
```

### 9. 外部通知の Port(ChannelNotifier)

Discord / Slack / Email への送信(`sendToDiscord` / `sendToSlack` / `sendToEmail`)と、メッセージ生成(`createChangelogMessage` 等)と `buildUnsubscribeUrl` は **application 層から直接呼ばない**。

| 関数・責務 | 置き場所 |
|---|---|
| `sendToDiscord` / `sendToSlack` / `sendToEmail` | `infrastructure/channel-notifier.ts` |
| `createChangelogMessage` / `createTestMessage` 等 | `infrastructure/channel-notifier.ts` |
| `buildUnsubscribeUrl` | `infrastructure/channel-notifier.ts` |

ドメイン層の `channel-notifier.ts` に `ChannelNotifier` port インターフェースを置き、infrastructure の実装が DSC/SLK/EML を切り替える。application 層は `ChannelNotifier` を受け取るだけで、Discord や Slack の存在を知らない。

biome の `useMaxParams: 3` ルールのもとで、application 層のユースケース関数は `(repo, notifier, input)` の3引数に収まる。

```ts
// domain/channel/channel-notifier.ts
type ChannelNotifier = {
  sendTestNotification(channel: Channel, unsubscribeUrl: string): Promise<{ ok: boolean }>
  sendChangelogNotification(channel: Channel, analysis: Analysis, version: string, urls: { unsubscribeUrl: string; siteUrl: string }): Promise<{ ok: boolean; status: number }>
  sendUnsubscribeNotification(channel: Channel): Promise<void>
}
```

### 10. ファイル粒度と命名規則

AI 支援開発において、無関係なコードを含む大きなファイルは不要なコンテキスト読み込みを生む。ドメイン層のファイルは責務単位で細かく分割し、1ファイルの関心を1つに絞る。

- 型定義のみ → `channel.ts`
- ライフサイクル操作 → `channel-lifecycle.ts`
- 失敗処理 → `channel-failure.ts`
- 値オブジェクトごとに独立したファイル → `discord-webhook-url.ts` など

**命名規則による型の発見性**: ファイル名 = 概念名とすることで「この型はどこに定義されているか」が一意に決まる。`channel.ts` を開けばChannel型、`discord-webhook-url.ts` を開けばDiscordWebhookUrl型と生成関数がある。型だけを集めた `types.ts` は作らない(型とロジックが分離してどちらがどこにあるかわからなくなるため)。

分割の判断基準：「この変更をするときに、このファイル以外を読む必要があるか？」

### 11. `cron/cleanup.ts` の位置づけ

スケジューラーから起動されるクリーンアップ処理は `routes/` と同様にエントリーポイントとして扱う。業務ルール(「無効化から X 日経過したチャンネルを削除する」)はドメイン層に、実際の DB 削除はインフラ層に置く。

```ts
// cron/cleanup.ts(エントリーポイント: スケジューラーからの起動のみ)
const repo = createChannelRepository(env.DB);
await cleanupInactiveChannels(repo);

// application/cleanup-inactive-channels.ts(進行管理)
export async function cleanupInactiveChannels(repo: ChannelRepository): Promise<void> {
  const targets = await repo.findDeactivatedBefore(cutoffDate);
  for (const channel of targets) {
    await repo.delete(channel.id);
  }
}
```

### 12. リポジトリ実装のクラス化

`infrastructure/drizzle/channel-repository.ts` の実装は `class` で書く。`db` と `emailEncryptionKey` をフィールドに持つことで、クロージャ factory 関数より見通しが良くなる。domain 層の `ChannelRepository` インターフェース(`type`)を実装する形は変わらない。

```ts
// infrastructure/drizzle/channel-repository.ts
class DrizzleChannelRepository implements ChannelRepository {
  constructor(
    private readonly db: DrizzleD1Database,
    private readonly emailEncryptionKey: string,
  ) {}

  async findById(id: ChannelId): Promise<Channel | null> { ... }
  // ...
}

export function createChannelRepository(binding: D1Database, key: string): ChannelRepository {
  return new DrizzleChannelRepository(drizzle(binding), key);
}
```

スーパータイプ/サブタイプ × 3チャンネル型の構造上、実装ファイルが肥大化しやすい。100行を超えるサブクエリ群は `discord-channel-queries.ts` 等に分割してよい。また SQL 日時フォーマット関数(`toSqlDateTime` 等)は `infrastructure/drizzle/` に置く。application 層に置かない。

### 13. 実装ガイドライン

**routes 層の条件分岐**

HTTP レスポンスの分岐(エラーコード、メッセージ)は handler 内に直接書く。`errorResponse` や `renderUnsubscribeResult` のような変換関数に切り出さない。

```ts
// Good: handler 内に直接書く
if (!result.ok) {
  switch (result.error) {
    case 'already_registered':
      return c.json({ error: '既に登録済みです' }, 409);
    case 'invalid_discord_webhook_url':
      return c.json({ error: 'Discord Webhook URLの形式が不正です' }, 400);
  }
}
```

**反復処理**

`spread + map` の短縮記法より `for...of` を優先する。処理の流れが明示的になる。

```ts
// Good
for (const channel of channels) {
  await notifier.sendChangelogNotification(channel, ...);
}

// Avoid: 何を組み立てているか見えにくい
return [...discordRows.map(mapDiscordRow), ...slackRows.map(mapSlackRow)];
```

**必須コメント箇所**

以下の箇所は背景説明コメントを必ず入れる。

| 箇所 | コメント内容 |
|---|---|
| `CHANNEL_ACTIVE_SENTINEL` 使用箇所 | `deactivated_at = '9999-12-31'` が「有効中」を示す番兵値であること |
| Email の hash/encrypt 処理 | 平文保存しないため検索は HMAC ハッシュ、送信時は暗号化済み本文を復号すること |
| 429 の retry 処理 | 一時的なレート制限のためキューメッセージごと再試行すること |
| 401/403/404 の失敗処理 | 通知先が失効した可能性が高いため恒久失敗として失敗回数を増やすこと |

### 14. DB スキーマ

現行のスーパータイプ/サブタイプ設計(ADR 0005)はドメインの discriminated union と対応しており、変更不要。

### 15. テスト方針

DDD 適用後のテスト構造：

| テスト対象 | 種別 | モック要否 |
|---|---|---|
| ドメイン層の業務ルール | ユニットテスト | 不要(純粋関数) |
| アプリケーション層のユースケース | ユニットテスト | リポジトリをモック |
| インフラ層のリポジトリ | 統合テスト | FakeD1 使用 |
| ルート層(HTTP) | 統合テスト | アプリケーション層をモック |

既存のテストは破壊的変更を許容して書き直す。

## Consequences

### Positive

- 業務ルールがドメイン層に集約され、「どこに何があるか」が層の名前から明確になる
- ドメイン層の業務ルールが純粋関数として書けるため、DB・HTTP なしでユニットテストが書ける
- 新しい通知チャンネルを追加する際の変更箇所が明確になる(domain → infrastructure → application の順に追加)
- アプリケーション層が薄いスクリプトになることで、処理の流れを上から読むだけで把握できる

### Negative

- ファイル数・フォルダ数が増え、初見の把握コストが上がる
  - → ファイル名がケバブケースで統一されており、概念名から検索できる
- Cloudflare Workers の `env` バインディングをどこで渡すかを毎回意識する必要がある
- 既存テストの書き直しコストが発生する

### Risks

- DDD の概念の習得途中で設計判断を誤り、後から層の境界を引き直す必要が出る可能性がある
  - → 最初から完璧にしようとせず、複雑さが出てきたタイミングで分割する方針を取る
- `changelog-fetcher` などほかのアプリへの DDD 適用は本 ADR の対象外とし、notification-worker の理解が定着してから検討する

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|---|---|---|
| `changelog-fetcher` への DDD 適用 | notification-worker での実践を通じて理解を深めてから判断する | notification-worker の DDD 実装が完了し、運用知見が得られた後 |

## Notes

### 参考資料

- ADR 0005: Drizzle ORM の導入とスーパータイプ/サブタイプ DB スキーマへの移行
- 参考: ドメイン駆動設計の各概念(値オブジェクト・エンティティ・集約・リポジトリ・アプリケーションサービス)については別途学習メモを参照
