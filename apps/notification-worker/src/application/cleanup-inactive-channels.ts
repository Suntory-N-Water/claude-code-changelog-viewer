import type { ChannelRepository } from '../domain/channel/channel-repository';

export type CleanupInactiveChannelsInput = {
  readonly cutoffDate: Date;
};

export type CleanupInactiveChannelsResult = {
  readonly deletedCount: number;
};

/** 指定日時より前に停止されたチャンネルを削除する。 */
export async function cleanupInactiveChannels(
  repository: ChannelRepository,
  input: CleanupInactiveChannelsInput,
): Promise<CleanupInactiveChannelsResult> {
  const channels = await repository.findDeactivatedBefore(input.cutoffDate);

  for (const channel of channels) {
    await repository.delete(channel.id);
  }

  return { deletedCount: channels.length };
}
