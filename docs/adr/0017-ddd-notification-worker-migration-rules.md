# ADR 0017: notification-worker DDD移行時の実装ルール

## Status

Proposed

## Context

ADR 0016 に従って notification-worker を DDD 構成へ移行している。移行中に、旧 `routes/` / `queue/` / `lib/` と新しい `domain` / `application` / `infrastructure` が混在し、以下の読みづらさと判断ブレが発生した。

- `buildUnsubscribeUrl` / `createUnsubscribeUrl` が複数箇所に重複し、unsubscribe URL の責務が分散した
- `routes` / `queue` が `sendToDiscord` / `sendToSlack` / `sendToEmail` やメッセージ生成関数を直接呼び、通知手段の詳細を知っていた
- 薄いラッパーや `try/catch` による変換失敗の握りつぶしで、何がメイン処理で何が内部処理なのか分かりにくくなった
- `createSubscribeInput()` の内部で `createNotificationFrequency()` を呼ぶなど、呼び出し元から見えないドメイン値変換が増えた
- `result.ok` と `!result.ok` の分岐順が混在し、異常系早期returnの流れが読みづらくなった

後方互換性は考慮しない。破壊的変更を許可し、移行中でも DDD の依存方向と読みやすさを優先する。

## Decision

### 1. 通知詳細は `ChannelNotifier` に閉じ込める

Discord / Slack / Email への送信、メッセージ生成、unsubscribe URL 生成は `infrastructure/channel-notifier.ts` の責務とする。

`routes` / `queue` / `application` は以下を直接呼ばない。

- `sendToDiscord`
- `sendToSlack`
- `sendToEmail`
- `createChangelogMessage` などの通知メッセージ生成関数
- `buildUnsubscribeUrl` / `createUnsubscribeUrl`

低レベル実装を `infrastructure/notification/*` に分ける場合でも、それは `channel-notifier.ts` の内部実装部品として扱う。`routes` / `queue` から直接 import しない。

### 2. 重複を消すための共通関数化を安易に選ばない

URL生成の重複だけを消すために `buildUnsubscribeUrl` のような共通関数を作ることは禁止する。

理由は、重複は消えても `routes` / `queue` が通知詳細を知る構造が残るため。DDD移行では、表面的な重複削減よりも、責務を正しい層へ移すことを優先する。

今回のように `routes` / `queue` に通知詳細が漏れている場合は、usecase + `ChannelNotifier` へ寄せて重複を根から消す。

### 3. `routes` はHTTP境界の処理だけを書く

`routes` の責務は以下に限定する。

- HTTP request の parse
- zod によるHTTP入力形式の検証
- Turnstile などHTTP入口で必要な検証
- ドメイン値への明示的な変換
- application usecase の呼び出し
- usecase結果からHTTP responseへの変換

DB操作、外部通知送信、メッセージ生成、unsubscribe URL生成は書かない。

### 4. ドメイン値変換はメイン処理から見えるようにする

HTTP入力をドメイン値へ変換する処理は、呼び出し元から見える場所に置く。

良い例:

```ts
const frequency = createNotificationFrequency(data.frequency);
const input = createSubscribeInput(data, frequency);

const result = await subscribe(repository, notifier, input);
```

避ける例:

```ts
const result = await subscribe(
  repository,
  notifier,
  createSubscribeInput(data),
);

function createSubscribeInput(data: RequestData): SubscribeInput {
  const frequency = createNotificationFrequency(data.frequency);
  // ...
}
```

`createSubscribeInput()` のような関数は、名前から予測できる範囲の組み立てに留める。複数のドメイン値生成を隠さない。

### 5. VO factory の例外を route で雑に catch しない

以下のような変換失敗の `try/catch` は避ける。

```ts
let input: SubscribeInput;
try {
  input = createSubscribeInput(data);
} catch (error) {
  return c.json({ error: (error as Error).message }, 400);
}
```

HTTP入力の形式エラーは `RequestSchema` で先に弾く。VO factory は検証済み値をドメイン型へ変換するために呼ぶ。

```ts
const RequestSchema = z.discriminatedUnion('channel_type', [
  z.object({
    channel_type: z.literal('DSC'),
    webhook_url: z.string().refine(isValidDiscordWebhookUrl),
    turnstile_token: z.string(),
    frequency: z.enum(['IMM', 'WEK']),
  }),
  // ...
]);
```

ただし、ドメイン層の値オブジェクト自体は不正値を拒否するために例外を投げてよい。route がその例外を通常の制御フローとして使わない、という意味である。

### 6. Result分岐は異常系を先に処理し、正常系を最後に置く

usecase結果を扱うときは、読みやすさのために異常系を早期returnし、正常系を最後に書く。

良い例:

```ts
if (!result.ok) {
  switch (result.error) {
    case 'already_registered':
      return c.json({ error: '既に登録済みです' }, 409);
    case 'invalid_notification_destination':
      return c.json({ error: '通知先が無効です' }, 400);
  }
}

return c.json({ success: true });
```

避ける例:

```ts
if (result.ok) {
  return c.json({ success: true });
}

switch (result.error) {
  // ...
}
```

周辺コードが `!parseResult.success` や `!turnstileValid` のように否定形の早期returnで進んでいる場合、途中で肯定形の正常系returnに切り替えない。

### 7. 薄いラッパーを増やさない

名前を変えるだけ、例外を握りつぶすだけ、内部で別関数へ丸投げするだけの薄いラッパーは作らない。

避ける例:

```ts
function toNotificationFrequency(
  frequency: string,
): NotificationFrequency | null {
  try {
    return createNotificationFrequency(frequency);
  } catch {
    return null;
  }
}
```

必要な変換は、呼び出し元から処理意図が見える形で書く。関数化する場合は、関数名から責務が明確に分かり、内部で何をするかが予測できる粒度にする。

### 8. `switch` は必要な分岐だけに使い、メイン処理を隠さない

DSC / SLK / EML のような discriminated union の組み立てには `switch` を使ってよい。

ただし、routeのメイン処理に大きな `switch` を直接置いて読みづらくしない。分岐が必要な場合は、`createSubscribeInput(data, frequency)` のような目的の明確な関数に閉じ込める。

## Consequences

- `routes` / `queue` は薄くなり、HTTP・Queue入口の責務に集中する
- 通知手段の追加・変更時は `ChannelNotifier` 実装を見ればよくなる
- 一時的な共通関数化で見た目だけ重複を減らすより、層の責務が明確になる
- 移行中でも、例外処理・変換処理・Result分岐の書き方が揃う
- テストコードが旧 `lib/discord` などをmockしている間は、旧ファイルが残ることがある。ただし本番コードからの参照は増やさない
