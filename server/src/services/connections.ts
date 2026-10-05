/**
 * Connections read model (SPEC §2, §3.5). A connection is a directed row owned by one person; it is *mutual*
 * when the peer's row back exists. Contact details, connections-only profiles and vouching require mutual, so
 * deleting your row revokes the other person's access to your contact details while they keep their own row.
 */
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { LIST_CAPS, type ConnectionSummary } from '@loopin/shared';
import type { Executor } from '../context';
import { connections, events, users, type ConnectionRow } from '../db/schema';
import { eventLiteColumns, toConnectionSummary, userLiteColumns } from './serializers';

/** A connection row without the owner's private notes and tags. */
export type ConnectionRef = Pick<ConnectionRow, 'id' | 'ownerId' | 'peerId' | 'eventId' | 'source' | 'createdAt'>;

export interface Relationship {
  /** The viewer's row to the target. */
  own: ConnectionRef | null;
  /** The target's row back to the viewer. */
  reverse: ConnectionRef | null;
  mutual: boolean;
}

/** Both directions between two people in one query (nobody is connected to themself). */
export async function getRelationship(ex: Executor, viewerId: string, targetId: string): Promise<Relationship> {
  const viewer = viewerId.toLowerCase();
  const target = targetId.toLowerCase();
  if (viewer === target) return { own: null, reverse: null, mutual: false };
  const rows = await ex
    .select({
      id: connections.id,
      ownerId: connections.ownerId,
      peerId: connections.peerId,
      eventId: connections.eventId,
      source: connections.source,
      createdAt: connections.createdAt,
    })
    .from(connections)
    .where(
      or(
        and(eq(connections.ownerId, viewer), eq(connections.peerId, target)),
        and(eq(connections.ownerId, target), eq(connections.peerId, viewer)),
      ),
    );
  const own = rows.find((row) => row.ownerId === viewer) ?? null;
  const reverse = rows.find((row) => row.ownerId === target) ?? null;
  return { own, reverse, mutual: own !== null && reverse !== null };
}

const reverseConnections = alias(connections, 'reverse_connection');

/** Owner rows with peer, "met at" event and the mutual flag; the peer's contact columns are NULL unless mutual. */
function selectConnectionSummaries(ex: Executor) {
  const mutual = sql<boolean>`${reverseConnections.id} is not null`;
  return ex
    .select({
      connection: {
        id: connections.id,
        notes: connections.notes,
        tags: connections.tags,
        source: connections.source,
        createdAt: connections.createdAt,
        updatedAt: connections.updatedAt,
      },
      peer: {
        ...userLiteColumns(users),
        openTo: users.openTo,
        location: users.location,
        linkedinUrl: users.linkedinUrl,
        websiteUrl: users.websiteUrl,
        // Contact details never leave the database for a connection that isn't mutual.
        contactEmail: sql<string | null>`case when ${mutual} then ${users.contactEmail} end`,
        phone: sql<string | null>`case when ${mutual} then ${users.phone} end`,
      },
      event: eventLiteColumns,
      mutual,
    })
    .from(connections)
    .innerJoin(users, eq(users.id, connections.peerId))
    .leftJoin(events, eq(events.id, connections.eventId))
    .leftJoin(
      reverseConnections,
      and(eq(reverseConnections.ownerId, connections.peerId), eq(reverseConnections.peerId, connections.ownerId)),
    )
    .$dynamic();
}

/**
 * The owner's connections, newest first: capped at LIST_CAPS.connections (GET /connections) unless `limit` says
 * otherwise; the account export passes `{ limit: null }` for all of them.
 */
export async function listConnectionSummaries(
  ex: Executor,
  ownerId: string,
  { limit = LIST_CAPS.connections, nowMs = Date.now() }: { limit?: number | null; nowMs?: number } = {},
): Promise<ConnectionSummary[]> {
  const query = selectConnectionSummaries(ex)
    .where(eq(connections.ownerId, ownerId))
    .orderBy(desc(connections.createdAt), desc(connections.id));
  const rows = await (limit === null ? query : query.limit(limit));
  return rows.map((row) => toConnectionSummary(row, nowMs));
}

/** One connection of the owner's, or null when it doesn't exist or belongs to someone else (→ 404). */
export async function getConnectionSummary(
  ex: Executor,
  ownerId: string,
  connectionId: string,
  nowMs: number = Date.now(),
): Promise<ConnectionSummary | null> {
  const [row] = await selectConnectionSummaries(ex)
    .where(and(eq(connections.id, connectionId), eq(connections.ownerId, ownerId)))
    .limit(1);
  return row ? toConnectionSummary(row, nowMs) : null;
}
