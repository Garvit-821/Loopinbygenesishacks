/**
 * Rotating badge tokens (the QR code a user shows to exchange profiles).
 *
 * Design (TOTP-like, works offline for the badge holder):
 *   - Every user has a random `badgeId` (UUID, rotatable) and a per-user `badgeKey`:
 *       badgeKey = HMAC-SHA256(QR_SECRET, "loopin-badge-v1:" + badgeId)      (server only derives it)
 *     The server hands badgeKey to the signed-in owner (GET /api/me/badge-key); the device caches it.
 *   - The device mints a token for the current 30-second slot without a network round-trip:
 *       bytes = [version:1][badgeId:16][slot:uint32 BE:4][mac:10]            (31 bytes → 42 base64url chars)
 *       mac   = first 10 bytes of HMAC-SHA256(badgeKey, bytes[0..21))
 *   - The server re-derives badgeKey from badgeId, checks the MAC in constant time and accepts slots in
 *     [now - BADGE.pastSlots, now + BADGE.futureSlots] (~60–90 s of validity, tolerant of small clock skew).
 *   - Rotating badgeId (POST /api/me/badge-key/rotate) invalidates every previously issued code at once.
 *   - Codes are NOT single-use: anyone holding a code can use it until it expires (~60–90 s). That is the
 *     intended trade-off (several people can scan the same screen); it stops reuse of photos/screenshots later.
 *     Client-side de-duplication must key on badgeDedupeKey() (badgeId + slot), never on the raw string.
 *
 * Connect tickets ("lpt_…") bridge the gap when someone opens a /c/<token> link while signed out: the server
 * swaps a *fresh* code for a ticket valid for CONNECT_TICKET.ttlSeconds, so they can sign up and still connect.
 * Tickets are bound to badgeId (rotating the code also kills outstanding tickets) and are minted only by the
 * server with a key derived from QR_SECRET:  ticketKey = HMAC-SHA256(QR_SECRET, CONNECT_TICKET.keyDerivationLabel).
 *
 * Uses Web Crypto only, so the exact same code runs in browsers (secure contexts) and Node >= 20.
 */
import { base64UrlDecode, base64UrlEncode, bytesToUuid, constantTimeEqual, uuidToBytes } from './encoding';

export const BADGE = {
  version: 1,
  slotSeconds: 30,
  pastSlots: 2,
  futureSlots: 1,
  macBytes: 10,
  tokenBytes: 31,
  tokenChars: 42,
  keyDerivationPrefix: 'loopin-badge-v1:',
} as const;

const SIGNED_BYTES = 1 + 16 + 4;

export interface ParsedBadgeToken {
  version: number;
  badgeId: string;
  slot: number;
  signed: Uint8Array<ArrayBuffer>;
  mac: Uint8Array<ArrayBuffer>;
}

export function badgeSlotAt(unixMs: number): number {
  return Math.floor(unixMs / 1000 / BADGE.slotSeconds);
}

/** Unix ms at which the current display slot rolls over (when the device should show a new code). */
export function badgeSlotEndsAt(slot: number): number {
  return (slot + 1) * BADGE.slotSeconds * 1000;
}

/** Unix ms after which the server will no longer accept a token minted for `slot`. */
export function badgeTokenExpiresAt(slot: number): number {
  return (slot + BADGE.pastSlots + 1) * BADGE.slotSeconds * 1000;
}

export function isBadgeSlotFresh(slot: number, nowMs: number): boolean {
  const now = badgeSlotAt(nowMs);
  return slot >= now - BADGE.pastSlots && slot <= now + BADGE.futureSlots;
}

function toKeyBytes(key: Uint8Array<ArrayBuffer> | string): Uint8Array<ArrayBuffer> {
  return typeof key === 'string' ? base64UrlDecode(key) : key;
}

async function hmacSha256(keyBytes: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto is unavailable. Badge codes need HTTPS or localhost.');
  const cryptoKey = await subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', cryptoKey, data));
}

function signedBytes(version: number, badgeId: string, slot: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(SIGNED_BYTES);
  out[0] = version;
  out.set(uuidToBytes(badgeId), 1);
  new DataView(out.buffer).setUint32(17, slot >>> 0, false);
  return out;
}

/** Mint the token for `slot`. `key` is the per-user badgeKey (raw bytes or base64url). */
export async function createBadgeToken(key: Uint8Array<ArrayBuffer> | string, badgeId: string, slot: number): Promise<string> {
  const signed = signedBytes(BADGE.version, badgeId, slot);
  const mac = (await hmacSha256(toKeyBytes(key), signed)).slice(0, BADGE.macBytes);
  const token = new Uint8Array(BADGE.tokenBytes);
  token.set(signed, 0);
  token.set(mac, SIGNED_BYTES);
  return base64UrlEncode(token);
}

/** Decode a raw token. Returns null for anything malformed (never throws). */
export function parseBadgeToken(token: string): ParsedBadgeToken | null {
  if (typeof token !== 'string' || token.length !== BADGE.tokenChars) return null;
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = base64UrlDecode(token);
  } catch {
    return null;
  }
  if (bytes.length !== BADGE.tokenBytes || bytes[0] !== BADGE.version) return null;
  const signed = bytes.slice(0, SIGNED_BYTES);
  return {
    version: bytes[0],
    badgeId: bytesToUuid(bytes.slice(1, 17)),
    slot: new DataView(bytes.buffer).getUint32(17, false),
    signed,
    mac: bytes.slice(SIGNED_BYTES),
  };
}

/** Constant-time MAC check. Freshness is checked separately with isBadgeSlotFresh(). */
export async function verifyBadgeTokenMac(key: Uint8Array<ArrayBuffer> | string, parsed: ParsedBadgeToken): Promise<boolean> {
  const expected = (await hmacSha256(toKeyBytes(key), parsed.signed)).slice(0, BADGE.macBytes);
  return constantTimeEqual(expected, parsed.mac);
}

/**
 * Pull a badge token out of whatever a scanner read: a Loopin link (".../c/<token>"),
 * a link with query/hash, or a bare token. Returns null when nothing token-shaped is present.
 */
export function extractBadgeToken(scanned: string): string | null {
  if (typeof scanned !== 'string') return null;
  const text = scanned.trim();
  const fromLink = text.match(/\/c\/([A-Za-z0-9_-]{42})(?:[/?#]|$)/);
  if (fromLink) return fromLink[1];
  return /^[A-Za-z0-9_-]{42}$/.test(text) ? text : null;
}

export function badgeLinkPath(token: string): string {
  return `/c/${token}`;
}

/** Stable identity of a scanned code for de-duplication (null when not a badge token). */
export function badgeDedupeKey(token: string): string | null {
  const parsed = parseBadgeToken(token);
  return parsed ? `${parsed.badgeId}:${parsed.slot}` : null;
}

// ---------------------------------------------------------------------------
// Connect tickets
// ---------------------------------------------------------------------------

export const CONNECT_TICKET = {
  prefix: 'lpt_',
  version: 1,
  ttlSeconds: 30 * 60,
  macBytes: 16,
  bytes: 1 + 16 + 4 + 16,
  keyDerivationLabel: 'loopin-connect-v1',
} as const;

const TICKET_SIGNED_BYTES = 1 + 16 + 4;
const TICKET_BODY_CHARS = Math.ceil((CONNECT_TICKET.bytes * 4) / 3);

export interface ParsedConnectTicket {
  badgeId: string;
  /** Unix seconds after which the ticket is no longer accepted. */
  expiresAt: number;
  signed: Uint8Array<ArrayBuffer>;
  mac: Uint8Array<ArrayBuffer>;
}

export function isConnectTicket(value: string): boolean {
  return typeof value === 'string' && value.startsWith(CONNECT_TICKET.prefix);
}

/** Server-only in practice: `key` must be the ticket key derived from QR_SECRET. */
export async function createConnectTicket(key: Uint8Array<ArrayBuffer> | string, badgeId: string, expiresAtUnixSec: number): Promise<string> {
  const signed = new Uint8Array(TICKET_SIGNED_BYTES);
  signed[0] = CONNECT_TICKET.version;
  signed.set(uuidToBytes(badgeId), 1);
  new DataView(signed.buffer).setUint32(17, expiresAtUnixSec >>> 0, false);
  const mac = (await hmacSha256(toKeyBytes(key), signed)).slice(0, CONNECT_TICKET.macBytes);
  const bytes = new Uint8Array(CONNECT_TICKET.bytes);
  bytes.set(signed, 0);
  bytes.set(mac, TICKET_SIGNED_BYTES);
  return CONNECT_TICKET.prefix + base64UrlEncode(bytes);
}

export function parseConnectTicket(ticket: string): ParsedConnectTicket | null {
  if (!isConnectTicket(ticket)) return null;
  const body = ticket.slice(CONNECT_TICKET.prefix.length);
  if (body.length !== TICKET_BODY_CHARS) return null;
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = base64UrlDecode(body);
  } catch {
    return null;
  }
  if (bytes.length !== CONNECT_TICKET.bytes || bytes[0] !== CONNECT_TICKET.version) return null;
  return {
    badgeId: bytesToUuid(bytes.slice(1, 17)),
    expiresAt: new DataView(bytes.buffer).getUint32(17, false),
    signed: bytes.slice(0, TICKET_SIGNED_BYTES),
    mac: bytes.slice(TICKET_SIGNED_BYTES),
  };
}

export async function verifyConnectTicketMac(key: Uint8Array<ArrayBuffer> | string, parsed: ParsedConnectTicket): Promise<boolean> {
  const expected = (await hmacSha256(toKeyBytes(key), parsed.signed)).slice(0, CONNECT_TICKET.macBytes);
  return constantTimeEqual(expected, parsed.mac);
}
