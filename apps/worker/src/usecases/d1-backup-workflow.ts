export type D1ExportPort = {
  start(): Promise<string>;
  fetchDump(bookmark: string): Promise<{
    readonly filename: string;
    readonly body: ReadableStream;
  }>;
};

export type BackupStorePort = {
  save(key: string, body: ReadableStream): Promise<{ readonly size: number }>;
};

export type BackupFailureReporterPort = {
  report(input: {
    readonly instanceId: string;
    readonly error: unknown;
  }): Promise<void>;
};

export type StoreD1BackupInput = {
  readonly bookmark: string;
  readonly exportedAt: string;
};

export async function storeD1Backup(
  d1Export: D1ExportPort,
  store: BackupStorePort,
  { bookmark, exportedAt }: StoreD1BackupInput,
): Promise<{ key: string; size: number }> {
  const dump = await d1Export.fetchDump(bookmark);
  // prefix は R2 のライフサイクルルールの対象と一致させる。
  const key = `notification-db/${exportedAt.slice(0, 10)}/${dump.filename}`;
  // ダンプ本体を Worker のメモリに載せず、ストリームのまま R2 へ渡す。
  const { size } = await store.save(key, dump.body);
  return { key, size };
}
