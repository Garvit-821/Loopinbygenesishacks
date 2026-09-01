export type HackerTier = 'Explorer' | 'Builder' | 'Veteran' | 'Grandmaster';

export type TrophyRank = '1st' | '2nd' | '3rd' | 'Special Bounty';

export interface SkillVector {
  category: string;
  score: number;
  maxScore: number;
  verifiedCommits: number;
}

export interface ActivityNode {
  date: string;
  count: number;
  eventId?: string;
}

export interface DevPassportStamp {
  id: string;
  eventId: string;
  eventName: string;
  date: string;
  organizerSignature: string;
  location: string;
  roleTag: string;
  verified: boolean;
  hash: string;
}

export interface Trophy {
  id: string;
  eventName: string;
  trackName: string;
  rank: TrophyRank;
  year: string;
  iconKey: string;
}

export interface PeerVouch {
  id: string;
  voucherHandle: string;
  voucherName: string;
  voucherAvatarUrl: string;
  moduleName: string;
  comment: string;
  verifiedAt: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  handle: string;
  name: string;
  avatarUrl: string;
  bio: string;
  primaryRole: string;
  githubUsername: string;
  linkedinUrl: string;
  portfolioUrl: string;
  tier: HackerTier;
  xpPoints: number;
  nextTierXp: number;
  rankPosition: number;
  totalHackathonsAttended: number;
  radarSkills: SkillVector[];
  activityMatrix: ActivityNode[];
  stamps: DevPassportStamp[];
  trophies: Trophy[];
  vouches: PeerVouch[];
  badgeHash: string;
}

export interface Connection {
  id: string;
  peerProfile: UserProfile;
  timestamp: string;
  privateNotes: string;
  tags: string[];
  eventMet: string;
  scanLatencyMs: number;
}

export interface EventFeedItem {
  id: string;
  title: string;
  content: string;
  type: 'announcement' | 'alert' | 'event';
  timestamp: string;
  urgent: boolean;
  actionUrl?: string;
  actionLabel?: string;
  venue?: string;
  eventDate?: string;
  rsvpCount?: number;
  isRsvpd?: boolean;
}

export interface QrPayload {
  version: string;
  type: 'passport_token' | 'profile_share';
  userId: string;
  handle: string;
  name: string;
  primaryRole: string;
  tier: HackerTier;
  badgeHash: string;
  timestamp: number;
  nonce: string;
  signature: string;
  profileSnapshot?: Partial<UserProfile>;
}

export interface ScanTelemetry {
  latencyMs: number;
  fps: number;
  rawPayload: string;
  timestamp: number;
  success: boolean;
}

export type TabType = 'passport' | 'connections' | 'feed';

export interface AuthSession {
  token: string;
  user: UserProfile;
  expiresAt: number;
}

export interface LoginCredentials {
  email?: string;
  password?: string;
  githubUsername?: string;
}

export interface SignUpData {
  name: string;
  handle: string;
  email: string;
  password?: string;
  primaryRole: string;
  githubUsername?: string;
  bio?: string;
}
