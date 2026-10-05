/**
 * Passport read model (SPEC §3.4): profile views under the visibility and mutual-connection rules, and the
 * credential and vouch lists they are built from (the account export reuses the loaders).
 *
 *  - self → full passport + contact details.
 *  - mutual connection → full passport + contact details.
 *  - public passport → full passport, no contact details.
 *  - connections-only passport → `{ restricted: true, user }` with only name and photo (headline '').
 */
import { and, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { LIST_CAPS, type ContactInfo, type Credential, type ProfileResponse, type ProfileView, type Vouch } from '@loopin/shared';
import type { Executor } from '../context';
import { credentials, events, users, vouches, type UserRow } from '../db/schema';
import { getRelationship } from './connections';
import {
  credentialViewColumns,
  eventLiteColumns,
  toContactInfo,
  toCredential,
  toPublicUser,
  toUserLite,
  toVouch,
  userLiteColumns,
  type ContactRow,
  type PublicUserRow,
} from './serializers';
import { computeActivity, computeProfileStats } from './stats';

/** What a profile view needs of its owner (a full UserRow works). */
export type ProfileTargetRow = PublicUserRow & ContactRow;

export interface ProfileViewInput {
  target: ProfileTargetRow;
  /** The signed-in viewer, or null when anonymous. */
  viewer: Pick<UserRow, 'id'> | null;
  nowMs?: number;
}

/** GET /profiles/:handle, GET /connections/:id: the target's passport as `viewer` may see it. */
export async function buildProfileView(ex: Executor, { target, viewer, nowMs = Date.now() }: ProfileViewInput): Promise<ProfileResponse> {
  if (viewer !== null && viewer.id === target.id) {
    return { restricted: false, profile: await buildSelfProfileView(ex, target, nowMs) };
  }
  const { own, mutual } = viewer === null ? { own: null, mutual: false } : await getRelationship(ex, viewer.id, target.id);
  if (!mutual && target.visibility !== 'public') {
    return { restricted: true, user: { ...toUserLite(target), headline: '' } };
  }
  const profile = await assembleProfileView(
    ex,
    target,
    mutual ? toContactInfo(target) : null,
    { isSelf: false, connectionId: own?.id ?? null, mutual },
    nowMs,
  );
  return { restricted: false, profile };
}

/** The user's own passport (GET /me/profile, account export): always full, with contact details. */
export function buildSelfProfileView(ex: Executor, user: ProfileTargetRow, nowMs: number = Date.now()): Promise<ProfileView> {
  return assembleProfileView(ex, user, toContactInfo(user), { isSelf: true, connectionId: null, mutual: false }, nowMs);
}

async function assembleProfileView(
  ex: Executor,
  user: ProfileTargetRow,
  contact: ContactInfo | null,
  relationship: ProfileView['relationship'],
  nowMs: number,
): Promise<ProfileView> {
  const [stats, credentialList, vouchList, activity] = await Promise.all([
    computeProfileStats(ex, user.id),
    loadCredentialsForUser(ex, user.id, { nowMs }),
    loadVouchesReceived(ex, user.id, { nowMs }),
    computeActivity(ex, user.id, nowMs),
  ]);
  return {
    user: toPublicUser(user),
    contact,
    stats,
    credentials: credentialList,
    vouches: vouchList,
    activity,
    visibility: user.visibility,
    relationship,
  };
}

export interface ListOptions {
  /** Row cap; null = no cap (account export). */
  limit?: number | null;
  nowMs?: number;
}

const issuers = alias(users, 'issuer');

/**
 * Credentials held by the user, newest first: non-revoked only and capped at LIST_CAPS.profileCredentials by
 * default; the account export passes `{ includeRevoked: true, limit: null }`.
 */
export async function loadCredentialsForUser(
  ex: Executor,
  userId: string,
  { includeRevoked = false, limit = LIST_CAPS.profileCredentials, nowMs = Date.now() }: ListOptions & { includeRevoked?: boolean } = {},
): Promise<Credential[]> {
  const query = ex
    .select({ credential: credentialViewColumns, event: eventLiteColumns, issuer: userLiteColumns(issuers) })
    .from(credentials)
    .innerJoin(events, eq(events.id, credentials.eventId))
    .leftJoin(issuers, eq(issuers.id, credentials.issuedBy))
    .where(and(eq(credentials.userId, userId), includeRevoked ? undefined : isNull(credentials.revokedAt)))
    .orderBy(desc(credentials.issuedAt), desc(credentials.id))
    .$dynamic();
  const rows = await (limit === null ? query : query.limit(limit));
  return rows.map((row) => toCredential(row, nowMs));
}

async function loadVouches(ex: Executor, where: SQL | undefined, { limit, nowMs = Date.now() }: ListOptions): Promise<Vouch[]> {
  const query = ex
    .select({
      vouch: {
        id: vouches.id,
        recipientId: vouches.recipientId,
        skill: vouches.skill,
        message: vouches.message,
        createdAt: vouches.createdAt,
      },
      voucher: userLiteColumns(users),
      event: eventLiteColumns,
    })
    .from(vouches)
    .innerJoin(users, eq(users.id, vouches.voucherId))
    .leftJoin(events, eq(events.id, vouches.eventId))
    .where(where)
    .orderBy(desc(vouches.createdAt), desc(vouches.id))
    .$dynamic();
  const rows = await (limit === null || limit === undefined ? query : query.limit(limit));
  return rows.map((row) => toVouch(row, nowMs));
}

/** Vouches the user received, newest first (capped at LIST_CAPS.profileVouches unless `limit` says otherwise). */
export function loadVouchesReceived(
  ex: Executor,
  userId: string,
  { limit = LIST_CAPS.profileVouches, nowMs }: ListOptions = {},
): Promise<Vouch[]> {
  return loadVouches(ex, eq(vouches.recipientId, userId), { limit, nowMs });
}

/**
 * Vouches the user gave, newest first, uncapped unless `limit` is set (account export). The voucher is the user
 * themself, so their headline is always included.
 */
export async function loadVouchesGiven(ex: Executor, userId: string, options: ListOptions = {}): Promise<Vouch[]> {
  const [voucher] = await ex.select(userLiteColumns(users)).from(users).where(eq(users.id, userId)).limit(1);
  if (!voucher) return [];
  const given = await loadVouches(ex, eq(vouches.voucherId, userId), options);
  const self = toUserLite(voucher, 'entitled');
  return given.map((vouch) => ({ ...vouch, voucher: self }));
}
