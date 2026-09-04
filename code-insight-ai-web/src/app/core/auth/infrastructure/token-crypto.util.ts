async function deriveKey(keyString: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(keyString));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptText(plainText: string, keyString: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const key = await deriveKey(keyString);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return bufferToBase64(combined);
  }
  return xorFallback(plainText, keyString);
}

export async function decryptText(
  cipherTextBase64: string,
  keyString: string,
): Promise<string | null> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const combined = base64ToBuffer(cipherTextBase64);
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const key = await deriveKey(keyString);
      const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      return new TextDecoder().decode(plainBuffer);
    }
    return xorFallback(cipherTextBase64, keyString, true);
  } catch {
    return null;
  }
}

function xorFallback(text: string, keyString: string, isEncoded = false): string {
  const input = isEncoded ? atob(text) : text;
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ keyString.charCodeAt(i % keyString.length);
    result += String.fromCharCode(charCode);
  }
  return isEncoded ? result : btoa(result);
}

/**
 * Deriva un nombre de clave de almacenamiento (sessionStorage/localStorage)
 * a partir de una etiqueta legible (ej. "idToken") y la clave de
 * ofuscación, de forma síncrona y determinística (mismo hash siempre para
 * el mismo par etiqueta+clave). Así el nombre de la entrada en
 * sessionStorage no revela directamente qué guarda (ej. en vez de
 * "codeInsightAi.idToken" queda algo como "ci_7f3a9c2e"), dificultando
 * que un atacante casual sepa qué buscar en DevTools.
 */
export function deriveStorageKeyName(label: string, keyString: string): string {
  const combined = `${keyString}::${label}`;
  // djb2 hash, simple y determinístico, sin depender de crypto.subtle
  // (debe poder ejecutarse de forma síncrona en el constructor).
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 33) ^ combined.charCodeAt(i);
  }
  // >>> 0 para forzar unsigned antes de convertir a hex
  return `ci_${(hash >>> 0).toString(16)}`;
}
