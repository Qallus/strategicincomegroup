import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for the SIG Credentials store. Encryption happens here, in the app; the
// database only ever holds ciphertext + IV + auth tag, so a dump without the app's
// master key is useless.
//
// Master key: CREDENTIALS_MASTER_KEY — 32 random bytes, base64 (`openssl rand -base64 32`).
// A 64-character hex string is accepted too.
//
// Rotation (key_version): rows record the key version that encrypted them. To rotate,
// keep the old key as CREDENTIALS_MASTER_KEY_V<old>, put the new key in
// CREDENTIALS_MASTER_KEY, set CREDENTIALS_KEY_VERSION=<old + 1>, then re-save the values
// (each save re-encrypts with the current version). Reads use the row's own version.
//
// The provider/instance/field triple is bound in as GCM additional data, so a ciphertext
// copied onto another row fails authentication instead of decrypting as the wrong key.

export class CredentialsKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialsKeyError";
  }
}

export type EncryptedValue = {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
};

export type EncryptedRow = EncryptedValue & { provider: string; instance: string; field: string };

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

export function currentKeyVersion(): number {
  const v = Number(process.env.CREDENTIALS_KEY_VERSION || 1);
  return Number.isInteger(v) && v > 0 ? v : 1;
}

function parseKey(raw: string, name: string): Buffer {
  const value = raw.trim();
  const buf = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (buf.length !== 32) {
    throw new CredentialsKeyError(`${name} must be 32 random bytes, base64-encoded (generate one with: openssl rand -base64 32).`);
  }
  return buf;
}

function keyFor(version: number): Buffer {
  const versioned = process.env[`CREDENTIALS_MASTER_KEY_V${version}`];
  if (versioned?.trim()) return parseKey(versioned, `CREDENTIALS_MASTER_KEY_V${version}`);
  if (version === currentKeyVersion()) {
    const main = process.env.CREDENTIALS_MASTER_KEY;
    if (main?.trim()) return parseKey(main, "CREDENTIALS_MASTER_KEY");
    throw new CredentialsKeyError("CREDENTIALS_MASTER_KEY is not set. Add it in Coolify (openssl rand -base64 32) before saving keys in the dashboard.");
  }
  throw new CredentialsKeyError(`No master key for key version ${version}. Set CREDENTIALS_MASTER_KEY_V${version} to the key that encrypted these values.`);
}

/** True when a usable master key is configured (does not reveal it). */
export function hasMasterKey(): boolean {
  try {
    keyFor(currentKeyVersion());
    return true;
  } catch {
    return false;
  }
}

const aadOf = (provider: string, instance: string, field: string) => Buffer.from(`${provider}\u0000${instance}\u0000${field}`, "utf8");

export function encrypt(value: string, provider: string, instance: string, field: string): EncryptedValue {
  const version = currentKeyVersion();
  const key = keyFor(version);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(aadOf(provider, instance, field));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
    key_version: version,
  };
}

export function decrypt(row: EncryptedRow): string {
  const key = keyFor(Number(row.key_version) || 1);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(row.iv, "base64"));
  decipher.setAAD(aadOf(row.provider, row.instance, row.field));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

/** Last four characters for the masked display — only for values long enough not to leak. */
export function last4Of(value: string): string | null {
  const v = value.trim();
  return v.length >= 8 ? v.slice(-4) : null;
}
