const CHANGELOG_URL =
  'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';
const KV_KEY = 'changelog-detection-state';
const DISPATCH_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/actions/workflows/changelog-auto-inference.yml/dispatches';
const USER_AGENT = 'notification-worker-changelog-detection';

type ChangelogDetectionState = {
  readonly contentHash: string;
  readonly lastCheckedAt: string;
  readonly lastDispatchedAt: string | null;
  readonly lastDispatchedHash: string | null;
};

export async function detectChangelogUpdate(
  bindings: CloudflareBindings,
  now: Date = new Date(),
): Promise<void> {
  const fetchedAt = now.toISOString();

  const response = await fetch(`${CHANGELOG_URL}?cb=${now.getTime()}`, {
    cf: { cacheTtl: 0 },
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(
      `CHANGELOG.md の取得に失敗しました: ${response.status} ${response.statusText}`,
    );
  }
  const body = await response.text();
  const contentHash = await sha256Hex(body);

  const previous = await readState(bindings.CHANGELOG_DETECTION_KV);

  if (previous && previous.contentHash === contentHash) {
    await writeState(bindings.CHANGELOG_DETECTION_KV, {
      ...previous,
      lastCheckedAt: fetchedAt,
    });
    return;
  }

  await dispatchWorkflow(
    bindings.GITHUB_DISPATCH_TOKEN,
    contentHash,
    fetchedAt,
  );

  await writeState(bindings.CHANGELOG_DETECTION_KV, {
    contentHash,
    lastCheckedAt: fetchedAt,
    lastDispatchedAt: fetchedAt,
    lastDispatchedHash: contentHash,
  });
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function readState(
  kv: KVNamespace,
): Promise<ChangelogDetectionState | null> {
  const raw = await kv.get(KV_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ChangelogDetectionState;
  } catch {
    return null;
  }
}

async function writeState(
  kv: KVNamespace,
  state: ChangelogDetectionState,
): Promise<void> {
  await kv.put(KV_KEY, JSON.stringify(state));
}

async function dispatchWorkflow(
  token: string,
  detectedHash: string,
  detectedAt: string,
): Promise<void> {
  const response = await fetch(DISPATCH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: { detected_hash: detectedHash, detected_at: detectedAt },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `workflow_dispatch の呼び出しに失敗しました: ${response.status} ${response.statusText} ${detail}`,
    );
  }
}
