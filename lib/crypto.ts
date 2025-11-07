const ITERATIONS = 120_000;

function getWebCrypto() {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto?.subtle) {
    return globalThis.crypto;
  }
  throw new Error("Web Crypto API tidak tersedia di lingkungan saat ini.");
}

const cryptoScope = getWebCrypto();
const subtle = cryptoScope.subtle;
const cryptoObj = cryptoScope;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface EncryptedPayload {
  salt: string;
  iv: string;
  ciphertext: string;
}

export async function encryptJson<T>(data: T, passphrase: string): Promise<EncryptedPayload> {
  const salt = cryptoObj.getRandomValues(new Uint8Array(16));
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ["encrypt"]);
  const encoded = textEncoder.encode(JSON.stringify(data));
  const cipherBuffer = await subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(new Uint8Array(cipherBuffer)),
  };
}

export async function decryptJson<T>(payload: EncryptedPayload, passphrase: string): Promise<T> {
  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);
  const key = await deriveKey(passphrase, salt, ["decrypt"]);
  const plainBuffer = await subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  const decoded = textDecoder.decode(plainBuffer);
  return JSON.parse(decoded) as T;
}

async function deriveKey(passphrase: string, salt: Uint8Array, usages: KeyUsage[]) {
  const passphraseBytes = textEncoder.encode(passphrase);
  const keyMaterial = await subtle.importKey("raw", passphraseBytes, "PBKDF2", false, ["deriveKey"]);
  const saltView =
    salt.byteOffset === 0 && salt.byteLength === salt.buffer.byteLength ? salt : salt.slice(0);
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltView as unknown as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

export function bufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  const base64 = btoa(binary);
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function base64ToBuffer(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const base64 = padded.padEnd(Math.ceil(padded.length / 4) * 4, "=");
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
