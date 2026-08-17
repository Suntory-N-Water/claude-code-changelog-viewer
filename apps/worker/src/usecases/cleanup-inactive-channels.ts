import type { ChannelRepository } from '../domain/channel/channel-repository';

export type CleanupInactiveChannelsInput = {
  now: Date;
};

export type CleanupInactiveChannelsResult = {
  deletedCount: number;
};

/** 指定日時より前に停止されたチャンネルを削除する。 */
export async function cleanupInactiveChannels(
  repository: ChannelRepository,
  input: CleanupInactiveChannelsInput,
): Promise<CleanupInactiveChannelsResult> {
  const cutoffDate = new Date(input.now);
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const channels = await repository.findDeactivatedBefore(cutoffDate);

  for (const channel of channels) {
    await repository.delete(channel.id);
  }

  return { deletedCount: channels.length };
}
