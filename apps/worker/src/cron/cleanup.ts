import { cleanupInactiveChannels as cleanupInactiveChannelsUsecase } from '../usecases/cleanup-inactive-channels';
import { createChannelRepository } from '../infrastructure/drizzle/channel-repository';

export async function cleanupInactiveChannels(
  bindings: CloudflareBindings,
  now = new Date(),
): Promise<void> {
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const repository = createChannelRepository(
    bindings.DB,
    bindings.EMAIL_ENCRYPTION_KEY,
  );
  await cleanupInactiveChannelsUsecase(repository, { cutoffDate });
}
