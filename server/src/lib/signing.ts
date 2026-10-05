/**
 * Ed25519 credential signing. The private key comes from a 32-byte seed (SIGNING_KEY); retired keys stay
 * verifiable through SIGNING_PUBLIC_KEYS_PREVIOUS. A key id is the first 16 hex chars of sha256(raw public key).
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import type { SigningKeyInfo } from '@loopin/shared';

/** DER prefix of a PKCS#8 Ed25519 private key; the 32-byte seed follows. */
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
/** DER prefix of an SPKI Ed25519 public key; the 32 raw key bytes follow. */
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{86}$/;

export interface Signer {
  /** Key id of the current signing key. */
  readonly keyId: string;
  /** base64url Ed25519 signature over the UTF-8 bytes of `payload`. */
  sign(payload: string): string;
  /** Verifies with the current key or a retired one; false for unknown key ids or malformed signatures. */
  verify(payload: string, signature: string, keyId: string): boolean;
  /** base64url raw public key for `keyId`, or null when this server doesn't know that key. */
  publicKeyFor(keyId: string): string | null;
  info(): SigningKeyInfo;
}

export function keyIdFor(rawPublicKey: Uint8Array): string {
  return createHash('sha256').update(rawPublicKey).digest('hex').slice(0, 16);
}

function publicKeyFromRaw(raw: Uint8Array): KeyObject {
  return createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, raw]), format: 'der', type: 'spki' });
}

function rawPublicKey(key: KeyObject): Buffer {
  const der = key.export({ format: 'der', type: 'spki' });
  return der.subarray(der.length - 32);
}

/**
 * @param seed 32-byte Ed25519 seed (env.SIGNING_KEY)
 * @param previousPublicKeys base64url raw public keys of retired keys (env.SIGNING_PUBLIC_KEYS_PREVIOUS)
 */
export function createSigner(seed: Uint8Array, previousPublicKeys: readonly string[] = []): Signer {
  if (seed.length !== 32) throw new Error('The Ed25519 signing seed must be 32 bytes');
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(privateKey);
  const currentRaw = rawPublicKey(publicKey);
  const keyId = keyIdFor(currentRaw);

  const keys = new Map<string, { object: KeyObject; raw: string }>([[keyId, { object: publicKey, raw: currentRaw.toString('base64url') }]]);
  for (const encoded of previousPublicKeys) {
    const raw = Buffer.from(encoded, 'base64url');
    if (raw.length !== 32) throw new Error('Previous signing public keys must be 32-byte base64url values');
    const id = keyIdFor(raw);
    if (!keys.has(id)) keys.set(id, { object: publicKeyFromRaw(raw), raw: raw.toString('base64url') });
  }

  const info: SigningKeyInfo = {
    keyId,
    algorithm: 'Ed25519',
    publicKey: currentRaw.toString('base64url'),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  };

  return {
    keyId,
    sign: (payload) => sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64url'),
    verify(payload, signature, id) {
      const key = keys.get(id);
      if (!key || !SIGNATURE_PATTERN.test(signature)) return false;
      try {
        return verify(null, Buffer.from(payload, 'utf8'), key.object, Buffer.from(signature, 'base64url'));
      } catch {
        return false;
      }
    },
    publicKeyFor: (id) => keys.get(id)?.raw ?? null,
    info: () => ({ ...info }),
  };
}
