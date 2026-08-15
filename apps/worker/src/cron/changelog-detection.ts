import { getLogger } from '@claude-code-changelog-viewer/common';
import { z } from 'zod';

const CHANGELOG_URL =
  'https://api.github.com/repos/anthropics/claude-code/contents/CHANGELOG.md?ref=main';
const KV_KEY = 'changelog-detection-state';
const DISPATCH_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/actions/workflows/changelog-auto-inference.yml/dispatches';
const RUNS_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/actions/workflows/changelog-auto-inference.yml/runs?event=workflow_dispatch&per_page=100';
const USER_AGENT = 'changelog-viewer-worker-changelog-detection';
const MAX_ATTEMPTS = 3;

const logger = getLogger({
  name: 'changelog-detection',
  level: 'INFO',
  format: 'json',
});

const ChangelogDetectionStateSchema = z.object({
  contentHash: z.string(),
  lastCheckedAt: z.string(),
  lastDispatchedAt: z.string(),
  lastDispatchedHash: z.string(),
  attempts: z.number(),
  confirmed: z.boolean(),
});

type ChangelogDetectionState = z.infer<typeof ChangelogDetectionStateSchema>;

type WorkflowRun = {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
};

function createGitHubHeaders(token: string, accept: string) {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': USER_AGENT,
  };
}

export async function detectChangelogUpdate(
  bindings: CloudflareBindings,
  now: Date = new Date(),
): Promise<void> {
  const fetchedAt = now.toISOString();

  const response = await fetch(CHANGELOG_URL, {
    headers: createGitHubHeaders(
      bindings.GITHUB_DISPATCH_TOKEN,
      'application/vnd.github.raw',
    ),
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
    logger.info('CHANGELOG に変化なし', { hash: contentHash });

    if (previous.confirmed || previous.attempts >= MAX_ATTEMPTS) {
      await writeState(bindings.CHANGELOG_DETECTION_KV, {
        ...previous,
        lastCheckedAt: fetchedAt,
      });
      return;
    }

    const runsResponse = await fetch(RUNS_URL, {
      headers: createGitHubHeaders(
        bindings.GITHUB_DISPATCH_TOKEN,
        'application/vnd.github+json',
      ),
    });
    if (!runsResponse.ok) {
      throw new Error(
        `workflow run の取得に失敗しました: ${runsResponse.status} ${runsResponse.statusText}`,
      );
    }
    const { workflow_runs: runs } = (await runsResponse.json()) as {
      workflow_runs: WorkflowRun[];
    };
    // workflow_dispatch は run id を返さないため、ハッシュ入り run-name で一意に特定する。
    const run = runs.find((candidate) =>
      candidate.name.includes(previous.lastDispatchedHash),
    );

    if (run?.status !== 'completed') {
      await writeState(bindings.CHANGELOG_DETECTION_KV, {
        ...previous,
        lastCheckedAt: fetchedAt,
      });
      return;
    }

    if (run.conclusion === 'success') {
      await writeState(bindings.CHANGELOG_DETECTION_KV, {
        ...previous,
        lastCheckedAt: fetchedAt,
        confirmed: true,
      });
      return;
    }

    await dispatchWorkflow(
      bindings.GITHUB_DISPATCH_TOKEN,
      contentHash,
      fetchedAt,
    );
    await writeState(bindings.CHANGELOG_DETECTION_KV, {
      ...previous,
      lastCheckedAt: fetchedAt,
      lastDispatchedAt: fetchedAt,
      attempts: previous.attempts + 1,
    });
    return;
  }

  logger.info('CHANGELOG の変化を検知、workflow_dispatch を起動', {
    previousHash: previous?.contentHash ?? null,
    newHash: contentHash,
  });
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
    attempts: 1,
    confirmed: false,
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
    const result = ChangelogDetectionStateSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
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
      ...createGitHubHeaders(token, 'application/vnd.github+json'),
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
