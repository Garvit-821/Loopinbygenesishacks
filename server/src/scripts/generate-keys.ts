/**
 * `npm run keys:generate` — print fresh production secrets as .env lines on stdout (notes go to stderr, so
 * `npm run -s keys:generate >> server/.env` works). Needs no configuration.
 */
import { randomBytes } from 'node:crypto';
import { createSigner } from '../lib/signing';

const qrSecret = randomBytes(32);
const signingSeed = randomBytes(32);
const signer = createSigner(signingSeed);

console.log(`QR_SECRET=${qrSecret.toString('base64url')}`);
console.log(`SIGNING_KEY=${signingSeed.toString('base64url')}`);
console.error(
  [
    `# Signing key id ${signer.keyId}, public key ${signer.info().publicKey}`,
    '# Keep both values secret. Changing QR_SECRET invalidates every badge code and connect link.',
    '# Before replacing SIGNING_KEY later, add the old public key (GET /api/keys → publicKey) to',
    '# SIGNING_PUBLIC_KEYS_PREVIOUS so credentials issued earlier still verify.',
  ].join('\n'),
);
