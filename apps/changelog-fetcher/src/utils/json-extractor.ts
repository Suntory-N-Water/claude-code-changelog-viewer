/**
 * AIレスポンスから```json ... ```コードブロックを抽出
 * @param aiResponse AIモデルからのテキストレスポンス
 * @returns 抽出されたJSON文字列(パース前)
 * @throws AIレスポンスにJSONコードブロックが見つからない場合
 */
export function extractJSON(aiResponse: string): string {
  // ```json ... ``` または ``` ... ``` パターンを抽出
  const jsonBlockPattern = /```(?:json)?\s*\n([\s\S]*?)\n```/;
  const match = aiResponse.match(jsonBlockPattern);

  if (!match?.[1]) {
    throw new Error('AIレスポンスにJSONコードブロックが見つかりませんでした');
  }

  return match[1].trim();
}
