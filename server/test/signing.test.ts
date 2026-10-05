import { createHash, verify as cryptoVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../src/lib/canonical';
import { createSigner, keyIdFor } from '../src/lib/signing';

const seedA = Buffer.alloc(32, 1);
const seedB = Buffer.alloc(32, 2);

describe('createSigner', () => {
  const signer = createSigner(seedA);
  const payload = canonicalJson({ v: 1, id: '6f1c2a54-8f0e-4c3e-9a51-2a6d9f1b7c10', type: 'stamp', issuedAt: '2026-10-05T10:00:00.000Z' });

  it('derives the key id from the raw public key', () => {
    const raw = Buffer.from(signer.info().publicKey, 'base64url');
    expect(raw).toHaveLength(32);
    expect(signer.keyId).toMatch(/^[0-9a-f]{16}$/);
    expect(signer.keyId).toBe(createHash('sha256').update(raw).digest('hex').slice(0, 16));
    expect(keyIdFor(raw)).toBe(signer.keyId);
  });

  it('signs deterministically and verifies with the current key', () => {
    const signature = signer.sign(payload);
    expect(signature).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(signer.sign(payload)).toBe(signature);
    expect(signer.verify(payload, signature, signer.keyId)).toBe(true);
  });

  it('rejects tampered payloads, signatures and unknown key ids', () => {
    const signature = signer.sign(payload);
    expect(signer.verify(payload.replace('stamp', 'award'), signature, signer.keyId)).toBe(false);
    const flipped = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
    expect(signer.verify(payload, flipped, signer.keyId)).toBe(false);
    expect(signer.verify(payload, 'not-a-signature', signer.keyId)).toBe(false);
    expect(signer.verify(payload, `${signature}==`, signer.keyId)).toBe(false);
    expect(signer.verify(payload, signature, '0000000000000000')).toBe(false);
  });

  it('keeps verifying signatures of retired keys listed as previous public keys', () => {
    const oldSignature = signer.sign(payload);
    const rotated = createSigner(seedB, [signer.info().publicKey]);
    expect(rotated.keyId).not.toBe(signer.keyId);
    expect(rotated.verify(payload, oldSignature, signer.keyId)).toBe(true);
    expect(rotated.publicKeyFor(signer.keyId)).toBe(signer.info().publicKey);
    expect(rotated.publicKeyFor(rotated.keyId)).toBe(rotated.info().publicKey);

    const forgotten = createSigner(seedB);
    expect(forgotten.verify(payload, oldSignature, signer.keyId)).toBe(false);
    expect(forgotten.publicKeyFor(signer.keyId)).toBeNull();
  });

  it('describes the current key', () => {
    const info = signer.info();
    expect(info.algorithm).toBe('Ed25519');
    expect(info.keyId).toBe(signer.keyId);
    expect(info.publicKeyPem).toMatch(/^-----BEGIN PUBLIC KEY-----\n[\s\S]+\n-----END PUBLIC KEY-----\n$/);
  });

  it('produces signatures anyone can verify with the published raw key (the /verify page snippet)', () => {
    const signature = signer.sign(payload);
    const key = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(signer.info().publicKey, 'base64url')]);
    expect(cryptoVerify(null, Buffer.from(payload), { key, format: 'der', type: 'spki' }, Buffer.from(signature, 'base64url'))).toBe(true);
  });

  it('rejects bad key material', () => {
    expect(() => createSigner(Buffer.alloc(31))).toThrow(/32 bytes/);
    expect(() => createSigner(seedA, ['short'])).toThrow(/32-byte/);
  });
});

describe('canonicalJson', () => {
  it('sorts keys recursively and emits no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: true, y: null }], c: 'x' } })).toBe('{"a":{"c":"x","d":[3,{"y":null,"z":true}]},"b":1}');
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });

  it('omits undefined members, keeps array order and escapes like JSON', () => {
    expect(canonicalJson({ a: undefined, b: [2, 1, undefined], c: 'line\n"quoted" ✓' })).toBe('{"b":[2,1,null],"c":"line\\n\\"quoted\\" ✓"}');
    expect(canonicalJson(new Date('2026-10-05T10:00:00Z'))).toBe('"2026-10-05T10:00:00.000Z"');
    expect(canonicalJson([])).toBe('[]');
    expect(canonicalJson({})).toBe('{}');
  });

  it('round-trips a signed credential payload exactly', () => {
    const payload = {
      v: 1,
      type: 'award',
      id: '6f1c2a54-8f0e-4c3e-9a51-2a6d9f1b7c10',
      holder: { name: 'Ada', handle: 'ada', id: 'a' },
      project: null,
      issuedAt: '2026-10-05T10:00:00.000Z',
    };
    const text = canonicalJson(payload);
    expect(text).toBe('{"holder":{"handle":"ada","id":"a","name":"Ada"},"id":"6f1c2a54-8f0e-4c3e-9a51-2a6d9f1b7c10","issuedAt":"2026-10-05T10:00:00.000Z","project":null,"type":"award","v":1}');
    expect(canonicalJson(JSON.parse(text))).toBe(text);
  });

  it('refuses values JSON cannot represent faithfully', () => {
    expect(() => canonicalJson(Number.NaN)).toThrow(TypeError);
    expect(() => canonicalJson({ n: Infinity })).toThrow(TypeError);
    expect(() => canonicalJson(10n)).toThrow(TypeError);
    expect(() => canonicalJson({ f: () => 1 })).toThrow(TypeError);
  });
});
