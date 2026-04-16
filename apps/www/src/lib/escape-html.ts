/**
 * HTMLテキストノードとして安全に埋め込むためのエスケープ
 * set:html でプレーンテキストを表示する際に使用する
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * <script> タグ内に JSON を埋め込む際のエスケープ
 * JSON.stringify は </script> をエスケープしないため、Unicode エスケープで代替する
 * JSON-LD など type="application/json" なスクリプトで使用する
 */
export function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
