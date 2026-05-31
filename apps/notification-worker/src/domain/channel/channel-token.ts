declare const channelTokenBrand: unique symbol;

export type ChannelToken = string & {
  readonly [channelTokenBrand]: unknown;
};

export function createChannelToken(value: string): ChannelToken {
  if (value.trim() === '') {
    throw new Error('チャンネルトークンが空です');
  }

  return value as ChannelToken;
}
