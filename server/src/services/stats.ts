/**
 * Reputation and activity (SPEC §2 XP, §3.4). XP is derived only from real records, using the numbers in
 * XP_RULES. One CTE query scores every user, so the rank is exact: 1 + the number of users with strictly more XP.
 * Aggregates are cast to int in SQL (node-postgres returns bigint/numeric as strings).
 */
import { sql, type SQL } from 'drizzle-orm';
import { XP_RULES, tierProgress, type ActivityDay, type ProfileStats } from '@loopin/shared';
import type { Executor } from '../context';
import { queryRows } from '../db/query';
import { notFound } from '../lib/errors';

/** XP_RULES numbers are compile-time constants, never user input, so they are inlined as SQL literals. */
function intLiteral(value: number): SQL {
  if (!Number.isSafeInteger(value)) throw new Error(`XP rule must be an integer, got ${value}`);
  return sql.raw(String(value));
}

/** `case placement when 'first' then 500 … else 0 end`, generated from XP_RULES.award. */
const AWARD_XP = sql`case placement ${sql.join(
  Object.entries(XP_RULES.award).map(([placement, xp]) => {
    if (!/^[a-z]+$/.test(placement)) throw new Error(`Unexpected award placement "${placement}"`);
    return sql`when ${sql.raw(`'${placement}'`)} then ${intLiteral(xp)}`;
  }),
  sql` `,
)} else 0 end`;

/**
 * The code points String.prototype.trim() removes (ECMAScript WhiteSpace + LineTerminator). profileChecklist
 * counts a headline/bio as written when `trim()` leaves something, i.e. when it has any other character.
 * Listed one by one (no `a-b` range) so the regex never depends on the database collation.
 */
const JS_TRIM_CODE_POINTS = [
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
  0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
];
/** Bound as a query parameter: "contains a character that trim() keeps". */
const HAS_CONTENT = `[^${String.fromCodePoint(...JS_TRIM_CODE_POINTS)}]`;

/** profileChecklist() in SQL, over `users u`: headline, bio, ≥ 3 skills, a photo or GitHub username, and a link. */
const PROFILE_COMPLETE = sql`(
  u.headline ~ ${HAS_CONTENT}
  and u.bio ~ ${HAS_CONTENT}
  and (case when jsonb_typeof(u.skills) = 'array' then jsonb_array_length(u.skills) else 0 end) >= 3
  and (coalesce(u.avatar_url, '') <> '' or coalesce(u.github_username, '') <> '')
  and (coalesce(u.github_username, '') <> '' or coalesce(u.linkedin_url, '') <> '' or coalesce(u.website_url, '') <> '')
)`;

interface StatsRow extends Record<string, unknown> {
  connections: number;
  stamps: number;
  events: number;
  awards: number;
  vouches: number;
  xp: number;
  rank: number;
  totalRanked: number;
}

function statsQuery(userId: string): SQL {
  return sql`
    with mutual as (
      select c.owner_id as user_id, count(*)::int as n
      from connections c
      join connections rev on rev.owner_id = c.peer_id and rev.peer_id = c.owner_id
      group by c.owner_id
    ),
    stamps as (
      select user_id, count(*)::int as n, count(distinct event_id)::int as events
      from credentials
      where type = 'stamp' and revoked_at is null
      group by user_id
    ),
    awards as (
      select user_id, count(*)::int as n, sum(${AWARD_XP})::int as xp
      from credentials
      where type = 'award' and revoked_at is null
      group by user_id
    ),
    received as (
      select recipient_id as user_id, count(*)::int as n, count(distinct voucher_id)::int as vouchers
      from vouches
      group by recipient_id
    ),
    scored as (
      select
        u.id,
        coalesce(m.n, 0) as connections,
        coalesce(s.n, 0) as stamps,
        coalesce(s.events, 0) as events,
        coalesce(a.n, 0) as awards,
        coalesce(v.n, 0) as vouches,
        coalesce(m.n, 0) * ${intLiteral(XP_RULES.connection)}
          + coalesce(s.n, 0) * ${intLiteral(XP_RULES.stamp)}
          + coalesce(v.vouchers, 0) * ${intLiteral(XP_RULES.vouchReceived)}
          + coalesce(a.xp, 0)
          + case when ${PROFILE_COMPLETE} then ${intLiteral(XP_RULES.profileComplete)} else 0 end as xp
      from users u
      left join mutual m on m.user_id = u.id
      left join stamps s on s.user_id = u.id
      left join awards a on a.user_id = u.id
      left join received v on v.user_id = u.id
    )
    select t.connections, t.stamps, t.events, t.awards, t.vouches, t.xp::int as xp, r.rank, r."totalRanked"
    from scored t
    cross join lateral (
      select (1 + count(*) filter (where o.xp > t.xp))::int as rank, count(*)::int as "totalRanked"
      from scored o
    ) r
    where t.id = ${userId}
  `;
}

/** XP, tier, rank and the counts behind them. 404 when the user doesn't exist. */
export async function computeProfileStats(ex: Executor, userId: string): Promise<ProfileStats> {
  const [row] = await queryRows<StatsRow>(ex, statsQuery(userId));
  if (!row) throw notFound();
  const tier = tierProgress(row.xp);
  return {
    xp: row.xp,
    tier: tier.tier,
    tierMinXp: tier.tierMinXp,
    nextTier: tier.nextTier,
    progress: tier.progress,
    rank: row.rank,
    totalRanked: row.totalRanked,
    connections: row.connections,
    events: row.events,
    stamps: row.stamps,
    awards: row.awards,
    vouches: row.vouches,
  };
}

/**
 * Activity per UTC day over the 365 days ending today (UTC): connections the user made, non-revoked credentials
 * they received, and vouches given or received. Non-zero days only, ascending.
 */
export async function computeActivity(ex: Executor, userId: string, nowMs: number = Date.now()): Promise<ActivityDay[]> {
  const rows = await queryRows<{ date: string; count: number }>(
    ex,
    sql`
      with bounds as (
        select (${new Date(nowMs).toISOString()}::timestamptz at time zone 'UTC')::date as today
      ),
      items as (
        select created_at as at from connections where owner_id = ${userId}
        union all
        select issued_at from credentials where user_id = ${userId} and revoked_at is null
        union all
        select created_at from vouches where voucher_id = ${userId}
        union all
        select created_at from vouches where recipient_id = ${userId}
      )
      select to_char(items.at at time zone 'UTC', 'YYYY-MM-DD') as date, count(*)::int as count
      from items cross join bounds
      where (items.at at time zone 'UTC')::date between bounds.today - 364 and bounds.today
      group by 1
      order by 1
    `,
  );
  return rows.map((row) => ({ date: row.date, count: row.count }));
}
