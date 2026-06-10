export type FetchedVersionClassification = 'new' | 'updated' | 'unchanged';

export function classifyFetchedVersion(input: {
  remoteHash: string;
  existingLocalHash: string | null;
  existsLocally: boolean;
}): FetchedVersionClassification {
  if (!input.existsLocally) {
    return 'new';
  }

  if (
    input.existingLocalHash === null ||
    input.remoteHash !== input.existingLocalHash
  ) {
    return 'updated';
  }

  return 'unchanged';
}
