/**
 * Reputation (XP) rules. XP is always *derived* from real records — nothing is self-reported.
 * The server computes XP/rank with these exact numbers (see server stats service) and the
 * web app uses tierProgress()/profileChecklist() for display, so both stay in sync.
 */
import type { AwardPlacement } from './constants';

export const XP_RULES = {
  connection: 10,
  stamp: 100,
  vouchReceived: 50,
  profileComplete: 50,
  award: {
    first: 500,
    second: 350,
    third: 250,
    special: 200,
    finalist: 150,
  } satisfies Record<AwardPlacement, number>,
} as const;

export const TIERS = [
  { name: 'Explorer', minXp: 0 },
  { name: 'Builder', minXp: 300 },
  { name: 'Veteran', minXp: 1500 },
  { name: 'Grandmaster', minXp: 4000 },
] as const;
export type TierName = (typeof TIERS)[number]['name'];

export interface XpCounts {
  /** Mutual connections (both directions exist). */
  connections: number;
  /** Non-revoked stamps. */
  stamps: number;
  /** Distinct people who vouched (several skills from the same person count once). */
  vouchesReceived: number;
  /** Non-revoked awards by placement. */
  awards: Partial<Record<AwardPlacement, number>>;
  profileComplete: boolean;
}

export function computeXp(c: XpCounts): number {
  let xp = c.connections * XP_RULES.connection + c.stamps * XP_RULES.stamp + c.vouchesReceived * XP_RULES.vouchReceived;
  for (const [placement, count] of Object.entries(c.awards) as [AwardPlacement, number | undefined][]) {
    xp += (count ?? 0) * XP_RULES.award[placement];
  }
  if (c.profileComplete) xp += XP_RULES.profileComplete;
  return xp;
}

export interface TierProgress {
  tier: TierName;
  tierMinXp: number;
  nextTier: { name: TierName; minXp: number } | null;
  /** 0..1 progress from the current tier floor to the next tier (1 at the top tier). */
  progress: number;
}

export function tierProgress(xp: number): TierProgress {
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) if (xp >= TIERS[i].minXp) index = i;
  const current = TIERS[index];
  const next = TIERS[index + 1] ?? null;
  const progress = next ? Math.min(1, Math.max(0, (xp - current.minXp) / (next.minXp - current.minXp))) : 1;
  return {
    tier: current.name,
    tierMinXp: current.minXp,
    nextTier: next ? { name: next.name, minXp: next.minXp } : null,
    progress,
  };
}

export interface ProfileCompletenessInput {
  headline: string;
  bio: string;
  skills: readonly unknown[];
  avatarUrl: string | null;
  githubUsername: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
}

export interface ChecklistItem {
  key: 'headline' | 'bio' | 'skills' | 'photo' | 'link';
  label: string;
  done: boolean;
}

/** Steps a user completes for the profile bonus. A GitHub username counts as a photo (avatar) and a link. */
export function profileChecklist(u: ProfileCompletenessInput): ChecklistItem[] {
  return [
    { key: 'headline', label: 'Add a headline', done: u.headline.trim().length > 0 },
    { key: 'bio', label: 'Write a short bio', done: u.bio.trim().length > 0 },
    { key: 'skills', label: 'Add at least 3 skills', done: u.skills.length >= 3 },
    { key: 'photo', label: 'Add a photo or GitHub username', done: Boolean(u.avatarUrl || u.githubUsername) },
    { key: 'link', label: 'Link GitHub, LinkedIn or a website', done: Boolean(u.githubUsername || u.linkedinUrl || u.websiteUrl) },
  ];
}

export function isProfileComplete(u: ProfileCompletenessInput): boolean {
  return profileChecklist(u).every((item) => item.done);
}
