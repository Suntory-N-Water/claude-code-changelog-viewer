const encoder = new TextEncoder();

export async function hashEmail(
  email: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(email));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function encryptEmail(
  email: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(email),
  );
  const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipher), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptEmail(
  encrypted: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const data = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: data.slice(0, 12) },
    key,
    data.slice(12),
  );
  return new TextDecoder().decode(plain);
}
