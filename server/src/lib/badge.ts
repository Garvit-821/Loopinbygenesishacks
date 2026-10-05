/**
 * Server side of rotating badge codes and connect tickets (codec in @loopin/shared/badge-token).
 * Errors are deliberately identity-free: an expired or forged code never reveals whose it was.
 */
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  BADGE,
  CONNECT_TICKET,
  badgeTokenExpiresAt,
  createConnectTicket,
  extractBadgeToken,
  isBadgeSlotFresh,
  isConnectTicket,
  parseBadgeToken,
  parseConnectTicket,
  verifyBadgeTokenMac,
  verifyConnectTicketMac,
} from '@loopin/shared';
import type { Executor } from '../context';
import { users, type UserRow } from '../db/schema';
import type { Env } from '../env';
import { badgeExpired, badgeInvalid } from './errors';

type BadgeEnv = Pick<Env, 'QR_SECRET'>;

export interface ResolvedBadgeCode {
  user: UserRow;
  /** 'token' = a rotating QR code; 'ticket' = a connect ticket from GET /badge/preview. */
  via: 'token' | 'ticket';
  /** When the code (or ticket) stops being accepted. */
  expiresAt: Date;
}

function hmac(key: Uint8Array, message: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(createHmac('sha256', key).update(message, 'utf8').digest());
}

/** Per-user badge key = HMAC-SHA256(QR_SECRET, "loopin-badge-v1:" + badgeId). Handed only to its owner. */
export function deriveBadgeKey(env: BadgeEnv, badgeId: string): Uint8Array<ArrayBuffer> {
  return hmac(env.QR_SECRET, BADGE.keyDerivationPrefix + badgeId.toLowerCase());
}

/** Key for connect-ticket MACs = HMAC-SHA256(QR_SECRET, "loopin-connect-v1"). Never leaves the server. */
export function ticketKey(env: BadgeEnv): Uint8Array<ArrayBuffer> {
  return hmac(env.QR_SECRET, CONNECT_TICKET.keyDerivationLabel);
}

/** A connect ticket ("lpt_…") for `badgeId`, valid for CONNECT_TICKET.ttlSeconds from `nowMs`. */
export function mintConnectTicket(env: BadgeEnv, badgeId: string, nowMs: number = Date.now()): Promise<string> {
  const expiresAtSec = Math.floor(nowMs / 1000) + CONNECT_TICKET.ttlSeconds;
  return createConnectTicket(ticketKey(env), badgeId.toLowerCase(), expiresAtSec);
}

async function userByBadgeId(ex: Executor, badgeId: string): Promise<UserRow | undefined> {
  const [user] = await ex.select().from(users).where(eq(users.badgeId, badgeId)).limit(1);
  return user;
}

/**
 * Resolve whatever was scanned or pasted — a bare badge token, a Loopin link (".../c/<token>") or a connect
 * ticket — to its owner. Throws HttpError badge_invalid (not a Loopin code, unknown/rotated, bad MAC) or
 * badge_expired (genuine but outside its validity window). For tokens the MAC is checked before freshness,
 * so a forged code is always "invalid", never "expired".
 */
export async function resolveBadgeCode(ex: Executor, env: BadgeEnv, raw: string, nowMs: number = Date.now()): Promise<ResolvedBadgeCode> {
  const text = typeof raw === 'string' ? raw.trim() : '';

  if (isConnectTicket(text)) {
    const ticket = parseConnectTicket(text);
    if (!ticket || !(await verifyConnectTicketMac(ticketKey(env), ticket))) throw badgeInvalid();
    const expiresAtMs = ticket.expiresAt * 1000;
    if (expiresAtMs <= nowMs) throw badgeExpired();
    const user = await userByBadgeId(ex, ticket.badgeId);
    if (!user) throw badgeInvalid();
    return { user, via: 'ticket', expiresAt: new Date(expiresAtMs) };
  }

  const token = extractBadgeToken(text);
  const parsed = token ? parseBadgeToken(token) : null;
  if (!parsed) throw badgeInvalid();
  const user = await userByBadgeId(ex, parsed.badgeId);
  if (!user) throw badgeInvalid();
  if (!(await verifyBadgeTokenMac(deriveBadgeKey(env, user.badgeId), parsed))) throw badgeInvalid();
  if (!isBadgeSlotFresh(parsed.slot, nowMs)) throw badgeExpired();
  return { user, via: 'token', expiresAt: new Date(badgeTokenExpiresAt(parsed.slot)) };
}

/**
 * Like resolveBadgeCode, but only for rotating QR codes (bare or inside a Loopin link): a connect ticket is
 * badge_invalid before anything else is checked, so even an expired ticket never answers badge_expired.
 * For GET /badge/preview and POST /events/:id/check-in, which must not accept tickets.
 */
export async function resolveBadgeToken(ex: Executor, env: BadgeEnv, raw: string, nowMs: number = Date.now()): Promise<ResolvedBadgeCode> {
  if (typeof raw !== 'string' || isConnectTicket(raw.trim())) throw badgeInvalid();
  return resolveBadgeCode(ex, env, raw, nowMs);
}
