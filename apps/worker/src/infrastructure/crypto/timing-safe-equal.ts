/** 文字列をハッシュ化して比較し、認証値の長さによるタイミング差を避ける。 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  return va.length === vb.length && va.every((byte, i) => byte === vb[i]);
}
