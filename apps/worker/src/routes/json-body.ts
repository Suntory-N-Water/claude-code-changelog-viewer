type JsonRequest = {
  json(): Promise<unknown>;
};

export type JsonBodyResult = { ok: true; value: unknown } | { ok: false };

/** JSON 構文エラーを、公開 HTTP 境界で扱える検証結果へ変換する。 */
export async function parseJsonBody(
  request: JsonRequest,
): Promise<JsonBodyResult> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}
