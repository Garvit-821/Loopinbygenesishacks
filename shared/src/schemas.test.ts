import { describe, expect, it } from 'vitest';
import {
  adminUsersQuery,
  badgePreviewQuery,
  checkInInput,
  createAwardInput,
  handleAvailabilityQuery,
  markNotificationsReadInput,
  uuidSchema,
  createAnnouncementInput,
  createEventInput,
  handleSchema,
  signupInput,
  tagsSchema,
  updateConnectionInput,
  updateProfileInput,
} from './schemas';
import { issuesToFields } from './errors';

describe('handleSchema', () => {
  it('normalises case and a leading @', () => {
    expect(handleSchema.parse('@Ada_Dev')).toBe('ada_dev');
  });
  it('rejects reserved and malformed handles', () => {
    expect(handleSchema.safeParse('admin').success).toBe(false);
    expect(handleSchema.safeParse('ab').success).toBe(false);
    expect(handleSchema.safeParse('has space').success).toBe(false);
    expect(handleSchema.safeParse('a'.repeat(25)).success).toBe(false);
  });
});

describe('signupInput', () => {
  it('lowercases email and reports field errors', () => {
    const ok = signupInput.parse({ name: ' Ada ', email: ' ADA@Example.COM ', password: 'longenough', handle: 'ada' });
    expect(ok).toEqual({ name: 'Ada', email: 'ada@example.com', password: 'longenough', handle: 'ada' });
    const bad = signupInput.safeParse({ name: '', email: 'nope', password: 'short', handle: 'x' });
    expect(bad.success).toBe(false);
    const fields = issuesToFields(bad.error!.issues);
    expect(Object.keys(fields).sort()).toEqual(['email', 'handle', 'name', 'password']);
  });
});

describe('updateProfileInput', () => {
  it('treats empty strings as "clear" and leaves absent keys undefined', () => {
    const parsed = updateProfileInput.parse({ websiteUrl: '', avatarUrl: null, githubUsername: '  ' });
    expect(parsed.websiteUrl).toBeNull();
    expect(parsed.avatarUrl).toBeNull();
    expect(parsed.githubUsername).toBeNull();
    expect('name' in parsed && parsed.name !== undefined).toBe(false);
  });
  it('normalises GitHub URLs and validates LinkedIn hosts', () => {
    expect(updateProfileInput.parse({ githubUsername: 'https://github.com/Garvit-821/' }).githubUsername).toBe('Garvit-821');
    expect(updateProfileInput.parse({ githubUsername: '@octocat' }).githubUsername).toBe('octocat');
    expect(updateProfileInput.safeParse({ linkedinUrl: 'https://evil.example.com/in/x' }).success).toBe(false);
    expect(updateProfileInput.parse({ linkedinUrl: 'https://www.linkedin.com/in/ada' }).linkedinUrl).toBe('https://www.linkedin.com/in/ada');
    expect(updateProfileInput.safeParse({ websiteUrl: 'javascript:alert(1)' }).success).toBe(false);
  });
  it('rejects duplicate skills and dedupes openTo', () => {
    expect(updateProfileInput.safeParse({ skills: [{ name: 'Rust', level: 3 }, { name: 'rust', level: 4 }] }).success).toBe(false);
    expect(updateProfileInput.parse({ openTo: ['team', 'team', 'hiring'] }).openTo).toEqual(['team', 'hiring']);
  });
  it('validates contact fields', () => {
    expect(updateProfileInput.parse({ contactEmail: 'Me@Mail.com', phone: '+91 98765 43210' })).toMatchObject({ phone: '+91 98765 43210' });
    expect(updateProfileInput.safeParse({ phone: 'call me' }).success).toBe(false);
  });
});

describe('connections', () => {
  it('dedupes tags case-insensitively and caps length', () => {
    expect(tagsSchema.parse(['AI', 'ai', ' Rust '])).toEqual(['AI', 'Rust']);
    expect(updateConnectionInput.safeParse({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).success).toBe(false);
  });
});

describe('organizer inputs', () => {
  it('requires the end of an event to be after its start', () => {
    const base = { name: 'Genesis', startsAt: '2026-11-18T09:00:00.000Z' };
    expect(createEventInput.safeParse({ ...base, endsAt: '2026-11-17T09:00:00.000Z' }).success).toBe(false);
    const ok = createEventInput.parse({ ...base, endsAt: '2026-11-20T18:00:00+05:30' });
    expect(ok.kind).toBe('hackathon');
    expect(ok.isActive).toBe(false);
  });
  it('check-in needs exactly one of token or handle', () => {
    expect(checkInInput.safeParse({ role: 'hacker' }).success).toBe(false);
    expect(checkInInput.safeParse({ handle: 'ada', token: 'x'.repeat(42) }).success).toBe(false);
    expect(checkInInput.parse({ handle: '@Ada' })).toEqual({ handle: 'ada', role: 'hacker' });
  });
  it('announcement buttons need a link', () => {
    expect(createAnnouncementInput.safeParse({ title: 'Food', body: 'Pizza in Hall B', actionLabel: 'Map' }).success).toBe(false);
    const ok = createAnnouncementInput.parse({ title: 'Food', body: 'Pizza in Hall B', actionLabel: '', actionUrl: '' });
    expect(ok).toMatchObject({ kind: 'info', urgent: false, actionLabel: null, actionUrl: null });
  });
});

describe('contract hygiene (review amendments)', () => {
  it('prefixes https:// for bare domains but still rejects non-web schemes', () => {
    expect(updateProfileInput.parse({ linkedinUrl: 'linkedin.com/in/ada' }).linkedinUrl).toBe('https://linkedin.com/in/ada');
    expect(updateProfileInput.parse({ websiteUrl: 'ada.dev' }).websiteUrl).toBe('https://ada.dev');
    expect(updateProfileInput.safeParse({ websiteUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(updateProfileInput.safeParse({ websiteUrl: 'mailto:a@b.co' }).success).toBe(false);
    expect(updateProfileInput.safeParse({ avatarUrl: 'http://example.com/a.png' }).success).toBe(false);
    expect(updateProfileInput.parse({ avatarUrl: 'example.com/a.png' }).avatarUrl).toBe('https://example.com/a.png');
  });

  it('rejects control and bidi characters in single-line fields, allows newlines in multi-line ones', () => {
    expect(updateProfileInput.safeParse({ name: 'Ada‮evil' }).success).toBe(false);
    expect(updateProfileInput.safeParse({ headline: 'line\nbreak' }).success).toBe(false);
    expect(updateProfileInput.parse({ bio: 'line one\r\nline two' }).bio).toBe('line one\nline two');
    expect(updateProfileInput.safeParse({ bio: 'bell\u0007' }).success).toBe(false);
    expect(updateConnectionInput.parse({ notes: 'Met at\tTrack 2\nFollow up' }).notes).toBe('Met at\tTrack 2\nFollow up');
  });

  it('accepts any 8-4-4-4-12 id (z.guid) and rejects junk', () => {
    expect(uuidSchema.safeParse('00000000-0000-0000-0000-000000000000').success).toBe(true);
    expect(uuidSchema.safeParse('3f2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b').success).toBe(true);
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('team awards dedupe handles and require at least one', () => {
    expect(createAwardInput.parse({ handles: ['@Ada', 'ada', 'bob_1'], placement: 'first' }).handles).toEqual(['ada', 'bob_1']);
    expect(createAwardInput.safeParse({ handles: [], placement: 'first' }).success).toBe(false);
    expect(createAwardInput.safeParse({ handles: Array.from({ length: 9 }, (_, i) => `user${i}x`), placement: 'first' }).success).toBe(false);
  });

  it('slugs cannot look like ids', () => {
    const base = { name: 'X', startsAt: '2026-11-18T09:00:00.000Z', endsAt: '2026-11-19T09:00:00.000Z' };
    expect(createEventInput.safeParse({ ...base, slug: '3f2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b' }).success).toBe(false);
    expect(createEventInput.safeParse({ ...base, slug: 'genesis-hacks-2026' }).success).toBe(true);
  });

  it('query schemas', () => {
    expect(adminUsersQuery.parse({})).toEqual({ q: '' });
    expect(badgePreviewQuery.safeParse({ token: 'short' }).success).toBe(false);
    expect(handleAvailabilityQuery.parse({ handle: '@Ada' })).toEqual({ handle: '@Ada' });
    expect(markNotificationsReadInput.parse({})).toEqual({});
  });
});
