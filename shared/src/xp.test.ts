import { describe, expect, it } from 'vitest';
import { computeXp, isProfileComplete, profileChecklist, tierProgress, TIERS, XP_RULES } from './xp';

describe('xp', () => {
  it('derives XP from real records only', () => {
    expect(computeXp({ connections: 0, stamps: 0, vouchesReceived: 0, awards: {}, profileComplete: false })).toBe(0);
    expect(
      computeXp({ connections: 3, stamps: 2, vouchesReceived: 1, awards: { first: 1, finalist: 2 }, profileComplete: true }),
    ).toBe(3 * 10 + 2 * 100 + 50 + 500 + 2 * 150 + XP_RULES.profileComplete);
  });

  it('maps XP onto tiers with progress', () => {
    expect(tierProgress(0)).toMatchObject({ tier: 'Explorer', nextTier: { name: 'Builder', minXp: 300 }, progress: 0 });
    expect(tierProgress(150).progress).toBeCloseTo(0.5);
    expect(tierProgress(300).tier).toBe('Builder');
    const top = tierProgress(TIERS[TIERS.length - 1].minXp + 999);
    expect(top).toMatchObject({ tier: 'Grandmaster', nextTier: null, progress: 1 });
  });

  it('computes the profile checklist', () => {
    const empty = { headline: '', bio: '', skills: [], avatarUrl: null, githubUsername: null, linkedinUrl: null, websiteUrl: null };
    expect(profileChecklist(empty).every((i) => !i.done)).toBe(true);
    const full = { ...empty, headline: 'Builder', bio: 'Hi', skills: [1, 2, 3], githubUsername: 'octocat' };
    expect(isProfileComplete(full)).toBe(true);
  });
});
