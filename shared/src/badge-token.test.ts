import { describe, expect, it } from 'vitest';
import {
  CONNECT_TICKET,
  badgeDedupeKey,
  createConnectTicket,
  isConnectTicket,
  parseConnectTicket,
  verifyConnectTicketMac,
  BADGE,
  badgeSlotAt,
  badgeTokenExpiresAt,
  createBadgeToken,
  extractBadgeToken,
  isBadgeSlotFresh,
  parseBadgeToken,
  verifyBadgeTokenMac,
} from './badge-token';
import { base64UrlDecode, base64UrlEncode, bytesToUuid, uuidToBytes } from './encoding';

const KEY = base64UrlEncode(new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff));
const OTHER_KEY = base64UrlEncode(new Uint8Array(32).fill(9));
const BADGE_ID = '3f2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b';

describe('encoding', () => {
  it('round-trips base64url and uuids', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes);
    expect(base64UrlEncode(bytes)).not.toMatch(/[+/=]/);
    expect(bytesToUuid(uuidToBytes(BADGE_ID))).toBe(BADGE_ID);
  });
});

describe('badge tokens', () => {
  it('creates a 42-char token that parses and verifies', async () => {
    const slot = badgeSlotAt(Date.UTC(2026, 9, 5, 12, 0, 0));
    const token = await createBadgeToken(KEY, BADGE_ID, slot);
    expect(token).toHaveLength(BADGE.tokenChars);
    const parsed = parseBadgeToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed!.badgeId).toBe(BADGE_ID);
    expect(parsed!.slot).toBe(slot);
    expect(await verifyBadgeTokenMac(KEY, parsed!)).toBe(true);
  });

  it('rejects a token checked against the wrong key', async () => {
    const token = await createBadgeToken(KEY, BADGE_ID, 1000);
    expect(await verifyBadgeTokenMac(OTHER_KEY, parseBadgeToken(token)!)).toBe(false);
  });

  it('rejects tampered slots', async () => {
    const token = await createBadgeToken(KEY, BADGE_ID, 1000);
    const bytes = base64UrlDecode(token);
    new DataView(bytes.buffer).setUint32(17, 1001, false);
    const tampered = parseBadgeToken(base64UrlEncode(bytes))!;
    expect(tampered.slot).toBe(1001);
    expect(await verifyBadgeTokenMac(KEY, tampered)).toBe(false);
  });

  it('returns null for malformed input instead of throwing', () => {
    expect(parseBadgeToken('')).toBeNull();
    expect(parseBadgeToken('x'.repeat(41))).toBeNull();
    expect(parseBadgeToken('!'.repeat(42))).toBeNull();
    const wrongVersion = new Uint8Array(BADGE.tokenBytes);
    wrongVersion[0] = 2;
    expect(parseBadgeToken(base64UrlEncode(wrongVersion))).toBeNull();
  });

  it('accepts slots inside the validity window only', () => {
    const now = Date.UTC(2026, 9, 5, 12, 0, 10);
    const slot = badgeSlotAt(now);
    expect(isBadgeSlotFresh(slot, now)).toBe(true);
    expect(isBadgeSlotFresh(slot - BADGE.pastSlots, now)).toBe(true);
    expect(isBadgeSlotFresh(slot - BADGE.pastSlots - 1, now)).toBe(false);
    expect(isBadgeSlotFresh(slot + BADGE.futureSlots, now)).toBe(true);
    expect(isBadgeSlotFresh(slot + BADGE.futureSlots + 1, now)).toBe(false);
    expect(badgeTokenExpiresAt(slot)).toBeGreaterThan(now);
    expect(isBadgeSlotFresh(slot, badgeTokenExpiresAt(slot))).toBe(false);
    expect(isBadgeSlotFresh(slot, badgeTokenExpiresAt(slot) - 1)).toBe(true);
  });

  it('extracts tokens from links and bare strings', async () => {
    const token = await createBadgeToken(KEY, BADGE_ID, 1234);
    expect(extractBadgeToken(token)).toBe(token);
    expect(extractBadgeToken(`  ${token}\n`)).toBe(token);
    expect(extractBadgeToken(`https://loopin.example.com/c/${token}`)).toBe(token);
    expect(extractBadgeToken(`https://loopin.example.com/c/${token}?ref=qr`)).toBe(token);
    expect(extractBadgeToken(`http://localhost:5173/c/${token}#x`)).toBe(token);
    expect(extractBadgeToken('https://example.com/hello')).toBeNull();
    expect(extractBadgeToken(`https://loopin.example.com/c/${token}extra`)).toBeNull();
    expect(extractBadgeToken('BEGIN:VCARD')).toBeNull();
  });
});

describe('connect tickets', () => {
  it('round-trips and verifies', async () => {
    const exp = 1_900_000_000;
    const ticket = await createConnectTicket(KEY, BADGE_ID, exp);
    expect(isConnectTicket(ticket)).toBe(true);
    expect(ticket.startsWith(CONNECT_TICKET.prefix)).toBe(true);
    const parsed = parseConnectTicket(ticket)!;
    expect(parsed).toMatchObject({ badgeId: BADGE_ID, expiresAt: exp });
    expect(await verifyConnectTicketMac(KEY, parsed)).toBe(true);
    expect(await verifyConnectTicketMac(OTHER_KEY, parsed)).toBe(false);
  });

  it('rejects tampering and junk', async () => {
    const ticket = await createConnectTicket(KEY, BADGE_ID, 1_900_000_000);
    const body = base64UrlDecode(ticket.slice(CONNECT_TICKET.prefix.length));
    new DataView(body.buffer).setUint32(17, 2_000_000_000, false);
    const tampered = parseConnectTicket(CONNECT_TICKET.prefix + base64UrlEncode(body))!;
    expect(await verifyConnectTicketMac(KEY, tampered)).toBe(false);
    expect(parseConnectTicket('lpt_short')).toBeNull();
    expect(parseConnectTicket(await createBadgeToken(KEY, BADGE_ID, 5))).toBeNull();
    expect(isConnectTicket('abc')).toBe(false);
  });

  it('derives a dedupe key from badge id + slot', async () => {
    const a = await createBadgeToken(KEY, BADGE_ID, 77);
    expect(badgeDedupeKey(a)).toBe(`${BADGE_ID}:77`);
    expect(badgeDedupeKey('nope')).toBeNull();
  });
});
