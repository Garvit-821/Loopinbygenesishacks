import {
  UserProfile,
  Connection,
  EventFeedItem,
  QrPayload,
  ActivityNode,
} from '../types';

const STORAGE_KEYS = {
  USER_PROFILE: 'loopin_user_profile_v1',
  CONNECTIONS: 'loopin_connections_v1',
  COMMUNITY_FEED: 'loopin_community_feed_v1',
};

// Generate 52 weeks of mock activity data with hackathon spikes
function generateMockActivity(): ActivityNode[] {
  const nodes: ActivityNode[] = [];
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (52 * 7 - 1));

  // Hackathon weekend dates
  const hackathonWeekends = [
    { offsetDays: 14, eventId: 'Genesis Hacks 2026' },
    { offsetDays: 56, eventId: 'Hackers Occupied Pune' },
    { offsetDays: 112, eventId: 'iQOO 2K Hackathon' },
    { offsetDays: 182, eventId: 'ETHIndia Hack Sprint' },
    { offsetDays: 252, eventId: 'FOSS Hack Winter' },
  ];

  for (let i = 0; i < 52 * 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    let count = 0;
    let eventId: string | undefined = undefined;

    // Check if this date falls near a hackathon
    const daysFromStart = i;
    const hackathon = hackathonWeekends.find(
      (h) => Math.abs(daysFromStart - (52 * 7 - h.offsetDays)) <= 2
    );

    if (hackathon) {
      count = Math.floor(Math.random() * 10) + 12; // 12-22 commits on hackathons
      eventId = hackathon.eventId;
    } else if (isWeekend) {
      count = Math.random() > 0.4 ? Math.floor(Math.random() * 8) + 2 : 0;
    } else {
      count = Math.random() > 0.25 ? Math.floor(Math.random() * 6) + 1 : 0;
    }

    nodes.push({ date: dateStr, count, eventId });
  }

  return nodes;
}

// Initial Mock User: Garvit Prakash (@gpdev)
const INITIAL_AUTH_USER: UserProfile = {
  id: 'usr_garvit_prakash_001',
  handle: '@gpdev',
  name: 'Garvit Prakash',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  bio: 'Principal AI Architect & Systems Engineer. Building autonomous agent swarms, sub-millisecond edge telemetry & high-speed mobile runtimes.',
  primaryRole: 'Full-Stack AI & Systems Architect',
  githubUsername: 'garvit-prakash',
  linkedinUrl: 'https://linkedin.com/in/garvit-prakash',
  portfolioUrl: 'https://github.com/garvit-prakash',
  tier: 'Grandmaster',
  xpPoints: 18450,
  nextTierXp: 20000,
  rankPosition: 3,
  totalHackathonsAttended: 14,
  badgeHash: 'sha256:8f4c9a12e3b76541d019fec38aa10b54e79124cb115984620adcbfe9082a4531',
  radarSkills: [
    { category: 'AI/ML Systems', score: 96, maxScore: 100, verifiedCommits: 420 },
    { category: 'Systems & Rust', score: 88, maxScore: 100, verifiedCommits: 280 },
    { category: 'Frontend & UI', score: 94, maxScore: 100, verifiedCommits: 390 },
    { category: 'Distributed Sys', score: 86, maxScore: 100, verifiedCommits: 195 },
    { category: 'Web3 & Security', score: 79, maxScore: 100, verifiedCommits: 110 },
    { category: 'DevOps & Cloud', score: 85, maxScore: 100, verifiedCommits: 160 },
  ],
  activityMatrix: generateMockActivity(),
  stamps: [
    {
      id: 'stamp_01',
      eventId: 'evt_genesis_2026',
      eventName: 'Genesis Hacks 2026',
      date: 'Aug 28-30, 2026',
      organizerSignature: 'GENESIS_CORE_0x98A1',
      location: 'Bengaluru, IN',
      roleTag: 'Track Winner (1st)',
      verified: true,
      hash: 'sig_rsa_4096_verified_994a',
    },
    {
      id: 'stamp_02',
      eventId: 'evt_iqoo_2k',
      eventName: 'iQOO 2K Hackathon',
      date: 'Jul 14-16, 2026',
      organizerSignature: 'IQOO_DEV_REL_0x55B2',
      location: 'Hyderabad, IN',
      roleTag: '1st Place Edge AI',
      verified: true,
      hash: 'sig_rsa_4096_verified_441c',
    },
    {
      id: 'stamp_03',
      eventId: 'evt_hackers_occupied_pune',
      eventName: 'Hackers Occupied Pune',
      date: 'May 10-12, 2026',
      organizerSignature: 'HOP_COMMITTEE_0x77C3',
      location: 'Pune, IN',
      roleTag: '2nd Place Systems',
      verified: true,
      hash: 'sig_rsa_4096_verified_118e',
    },
    {
      id: 'stamp_04',
      eventId: 'evt_ethindia_2025',
      eventName: 'ETHIndia Hackathon',
      date: 'Dec 05-07, 2025',
      organizerSignature: 'ETH_GLOBAL_0x33F9',
      location: 'Bengaluru, IN',
      roleTag: 'Top 10 Finalist',
      verified: true,
      hash: 'sig_rsa_4096_verified_220a',
    },
  ],
  trophies: [
    {
      id: 'trophy_01',
      eventName: 'Genesis Hacks 2026',
      trackName: 'Autonomous AI Agents & RAG',
      rank: '1st',
      year: '2026',
      iconKey: 'trophy-gold',
    },
    {
      id: 'trophy_02',
      eventName: 'iQOO 2K Hackathon',
      trackName: 'On-Device Mobile Inference',
      rank: '1st',
      year: '2026',
      iconKey: 'trophy-gold',
    },
    {
      id: 'trophy_03',
      eventName: 'Hackers Occupied Pune',
      trackName: 'High-Throughput P2P Relays',
      rank: '2nd',
      year: '2026',
      iconKey: 'trophy-silver',
    },
    {
      id: 'trophy_04',
      eventName: 'ETHIndia 2025',
      trackName: 'Zero-Knowledge Credentialing',
      rank: 'Special Bounty',
      year: '2025',
      iconKey: 'trophy-purple',
    },
  ],
  vouches: [
    {
      id: 'vouch_01',
      voucherHandle: '@ananya_ml',
      voucherName: 'Ananya Sharma',
      voucherAvatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
      moduleName: 'Autonomous Agent Engine & Vector Indexing',
      comment: 'Engineered the sub-400ms QR decoding pipeline and vector indexing backend for our team in 36 hours flat. Absolutely top tier.',
      verifiedAt: 'Genesis Hacks 2026',
    },
    {
      id: 'vouch_02',
      voucherHandle: '@rohan_sys',
      voucherName: 'Rohan Mehta',
      voucherAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      moduleName: 'Rust WebAssembly Memory Optimization',
      comment: 'Cracked the zero-copy buffer serialization between native Android and web runtime during our finals demo.',
      verifiedAt: 'Hackers Occupied Pune',
    },
    {
      id: 'vouch_03',
      voucherHandle: '@priya_ui',
      voucherName: 'Priya Nair',
      voucherAvatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
      moduleName: 'GPU-Accelerated Holographic Shaders',
      comment: 'Designed full tactile feedback loops and high-density telemetry dashboards with zero frame drops.',
      verifiedAt: 'iQOO 2K Hackathon',
    },
  ],
};

// Rich initial Connections dataset
const INITIAL_CONNECTIONS: Connection[] = [
  {
    id: 'conn_001',
    peerProfile: {
      id: 'usr_ananya_002',
      handle: '@ananya_ml',
      name: 'Ananya Sharma',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
      bio: 'Research Scientist @ NeuroSys. Specializing in Graph Neural Networks, LLM agent alignment, and multi-modal embeddings.',
      primaryRole: 'AI/ML Research Engineer',
      githubUsername: 'ananya-sharma-ml',
      linkedinUrl: 'https://linkedin.com/in/ananya-sharma',
      portfolioUrl: 'https://github.com/ananya-sharma-ml',
      tier: 'Grandmaster',
      xpPoints: 16900,
      nextTierXp: 20000,
      rankPosition: 5,
      totalHackathonsAttended: 11,
      badgeHash: 'sha256:77bc09912aaee41209bca348810239128f7450',
      radarSkills: [
        { category: 'AI/ML Systems', score: 98, maxScore: 100, verifiedCommits: 510 },
        { category: 'Systems & Rust', score: 74, maxScore: 100, verifiedCommits: 140 },
        { category: 'Frontend & UI', score: 68, maxScore: 100, verifiedCommits: 90 },
        { category: 'Distributed Sys', score: 89, maxScore: 100, verifiedCommits: 230 },
        { category: 'Web3 & Security', score: 60, maxScore: 100, verifiedCommits: 50 },
        { category: 'DevOps & Cloud', score: 82, maxScore: 100, verifiedCommits: 160 },
      ],
      activityMatrix: [],
      stamps: [
        {
          id: 's_ananya_01',
          eventId: 'evt_genesis_2026',
          eventName: 'Genesis Hacks 2026',
          date: 'Aug 28-30, 2026',
          organizerSignature: 'GENESIS_CORE_0x98A1',
          location: 'Bengaluru, IN',
          roleTag: 'Team Co-lead',
          verified: true,
          hash: 'sig_rsa_4096_verified_ananya_1',
        },
      ],
      trophies: [
        {
          id: 't_ananya_01',
          eventName: 'Genesis Hacks 2026',
          trackName: 'Autonomous AI Agents',
          rank: '1st',
          year: '2026',
          iconKey: 'trophy-gold',
        },
      ],
      vouches: [],
    },
    timestamp: '2026-08-30T14:22:10Z',
    privateNotes: 'Met at Track 1 presentation. Great discussion on integrating custom GNNs with our fast QR edge indexer. Follow up next Tuesday.',
    tags: ['AI/ML', 'Genesis 2026', 'Potential Co-Founder', 'High-Conviction'],
    eventMet: 'Genesis Hacks 2026',
    scanLatencyMs: 312,
  },
  {
    id: 'conn_002',
    peerProfile: {
      id: 'usr_rohan_003',
      handle: '@rohan_sys',
      name: 'Rohan Mehta',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      bio: 'Low-latency systems hacker. Building lock-free queues, Linux kernel eBPF observability, and Rust networking primitives.',
      primaryRole: 'Systems & Kernel Engineer',
      githubUsername: 'rohanm-sys',
      linkedinUrl: 'https://linkedin.com/in/rohan-mehta-sys',
      portfolioUrl: 'https://github.com/rohanm-sys',
      tier: 'Veteran',
      xpPoints: 14200,
      nextTierXp: 15000,
      rankPosition: 12,
      totalHackathonsAttended: 9,
      badgeHash: 'sha256:99bb114400aacc88319e712390fcaabbc88123',
      radarSkills: [
        { category: 'AI/ML Systems', score: 62, maxScore: 100, verifiedCommits: 90 },
        { category: 'Systems & Rust', score: 99, maxScore: 100, verifiedCommits: 620 },
        { category: 'Frontend & UI', score: 55, maxScore: 100, verifiedCommits: 60 },
        { category: 'Distributed Sys', score: 94, maxScore: 100, verifiedCommits: 410 },
        { category: 'Web3 & Security', score: 81, maxScore: 100, verifiedCommits: 180 },
        { category: 'DevOps & Cloud', score: 90, maxScore: 100, verifiedCommits: 310 },
      ],
      activityMatrix: [],
      stamps: [
        {
          id: 's_rohan_01',
          eventId: 'evt_hackers_occupied_pune',
          eventName: 'Hackers Occupied Pune',
          date: 'May 10-12, 2026',
          organizerSignature: 'HOP_COMMITTEE_0x77C3',
          location: 'Pune, IN',
          roleTag: 'Podium Finish',
          verified: true,
          hash: 'sig_rsa_4096_verified_rohan_1',
        },
      ],
      trophies: [
        {
          id: 't_rohan_01',
          eventName: 'Hackers Occupied Pune',
          trackName: 'P2P Relays',
          rank: '2nd',
          year: '2026',
          iconKey: 'trophy-silver',
        },
      ],
      vouches: [],
    },
    timestamp: '2026-08-29T18:45:00Z',
    privateNotes: 'Wants to collaborate on open-source eBPF network telemetry for hackathon clusters.',
    tags: ['Rust/Systems', 'High-Conviction', 'Infrastructure'],
    eventMet: 'Genesis Hacks 2026',
    scanLatencyMs: 278,
  },
  {
    id: 'conn_003',
    peerProfile: {
      id: 'usr_priya_004',
      handle: '@priya_ui',
      name: 'Priya Nair',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
      bio: 'Design Engineer bridging Figma tokens with WebGL and React Three Fiber. Obsessed with micro-interactions and tactile UI.',
      primaryRole: 'Lead UI/UX Design Engineer',
      githubUsername: 'priya-design-code',
      linkedinUrl: 'https://linkedin.com/in/priya-nair-ui',
      portfolioUrl: 'https://github.com/priya-design-code',
      tier: 'Veteran',
      xpPoints: 13800,
      nextTierXp: 15000,
      rankPosition: 18,
      totalHackathonsAttended: 8,
      badgeHash: 'sha256:44aa00998822eeff11335577662244bbccdd',
      radarSkills: [
        { category: 'AI/ML Systems', score: 65, maxScore: 100, verifiedCommits: 80 },
        { category: 'Systems & Rust', score: 50, maxScore: 100, verifiedCommits: 40 },
        { category: 'Frontend & UI', score: 99, maxScore: 100, verifiedCommits: 580 },
        { category: 'Distributed Sys', score: 60, maxScore: 100, verifiedCommits: 75 },
        { category: 'Web3 & Security', score: 70, maxScore: 100, verifiedCommits: 90 },
        { category: 'DevOps & Cloud', score: 75, maxScore: 100, verifiedCommits: 110 },
      ],
      activityMatrix: [],
      stamps: [],
      trophies: [],
      vouches: [],
    },
    timestamp: '2026-08-28T22:15:30Z',
    privateNotes: 'Designed the Genesis brand assets. Talked about holographic shader implementations in CSS/Canvas.',
    tags: ['Frontend & UI', 'Figma', 'Genesis 2026'],
    eventMet: 'Genesis Hacks 2026',
    scanLatencyMs: 345,
  },
];

// Rich Mock Community Feed Items
const INITIAL_COMMUNITY_FEED: EventFeedItem[] = [
  {
    id: 'feed_001',
    title: '🚨 CRITICAL: Stage 1 Final Demos & Pitch Lineup Announced',
    content: 'All top 10 finalist teams are requested to assemble at the Main Arena stage with HDMI adapters. 3 minutes pitch + 2 minutes judge Q&A.',
    type: 'alert',
    timestamp: '10 minutes ago',
    urgent: true,
    actionUrl: '#',
    actionLabel: 'View Pitch Schedule',
    venue: 'Main Arena • Audi A',
  },
  {
    id: 'feed_002',
    title: '🍕 Midnight Energy Drop & Red Bull Restock at Hangar B',
    content: 'Fresh wood-fired pizzas, espresso, and energy drinks are live at the Maker Lounge. Flash your Loopin Dev Passport for priority badge scan.',
    type: 'announcement',
    timestamp: '35 minutes ago',
    urgent: false,
    venue: 'Hangar B • Maker Lounge',
  },
  {
    id: 'feed_003',
    title: '⚡ 1-on-1 VC & Founder Office Hours (Open Slots)',
    content: 'Partners from Genesis Capital & Nexus Ventures are holding drop-in mentorship slots for teams preparing post-hackathon seed funding.',
    type: 'announcement',
    timestamp: '1 hour ago',
    urgent: false,
    actionUrl: '#',
    actionLabel: 'Book 15m Mentor Slot',
    venue: 'VIP Lounge 2',
  },
  {
    id: 'feed_004',
    title: '🏆 Genesis Winter Invitational 2026: Applications Open',
    content: 'The flagship 48-hour hardware and AI residency hackathon in Goa. Limited to 250 verified Grandmaster & Veteran badge holders.',
    type: 'event',
    timestamp: '3 hours ago',
    urgent: false,
    actionUrl: '#',
    actionLabel: 'RSVP / Reserve Pass',
    venue: 'Goa Coastal Campus',
    eventDate: 'Nov 18 - 20, 2026',
    rsvpCount: 184,
    isRsvpd: false,
  },
];

// Mock Peers for fast test scanning simulation
export const MOCK_TEST_PEERS: UserProfile[] = [
  {
    id: 'usr_marcus_005',
    handle: '@marcus_v',
    name: 'Marcus Vance',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    bio: 'Distributed Systems & Database Engine Developer. Contributor to CockroachDB and Raft consensus engines.',
    primaryRole: 'Distributed DB Engineer',
    githubUsername: 'marcus-vance-core',
    linkedinUrl: 'https://linkedin.com/in/marcus-vance',
    portfolioUrl: 'https://github.com/marcus-vance-core',
    tier: 'Grandmaster',
    xpPoints: 17400,
    nextTierXp: 20000,
    rankPosition: 4,
    totalHackathonsAttended: 12,
    badgeHash: 'sha256:91823abce12837482910fedcba983712',
    radarSkills: [
      { category: 'AI/ML Systems', score: 70, maxScore: 100, verifiedCommits: 120 },
      { category: 'Systems & Rust', score: 97, maxScore: 100, verifiedCommits: 540 },
      { category: 'Frontend & UI', score: 50, maxScore: 100, verifiedCommits: 40 },
      { category: 'Distributed Sys', score: 98, maxScore: 100, verifiedCommits: 620 },
      { category: 'Web3 & Security', score: 85, maxScore: 100, verifiedCommits: 210 },
      { category: 'DevOps & Cloud', score: 92, maxScore: 100, verifiedCommits: 380 },
    ],
    activityMatrix: [],
    stamps: [
      {
        id: 's_marcus_01',
        eventId: 'evt_genesis_2026',
        eventName: 'Genesis Hacks 2026',
        date: 'Aug 28-30, 2026',
        organizerSignature: 'GENESIS_CORE_0x98A1',
        location: 'Bengaluru, IN',
        roleTag: 'Finalist',
        verified: true,
        hash: 'sig_marcus_v1',
      },
    ],
    trophies: [
      {
        id: 't_marcus_01',
        eventName: 'Distributed Systems Summit',
        trackName: 'Consensus Primitives',
        rank: '1st',
        year: '2026',
        iconKey: 'trophy-gold',
      },
    ],
    vouches: [],
  },
  {
    id: 'usr_elena_006',
    handle: '@elena_zk',
    name: 'Elena Rostova',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    bio: 'Cryptography researcher focused on zero-knowledge SNARKs, verifiable compute, and private identity proofs.',
    primaryRole: 'ZK & Cryptography Researcher',
    githubUsername: 'elena-zk-snarks',
    linkedinUrl: 'https://linkedin.com/in/elena-rostova-zk',
    portfolioUrl: 'https://github.com/elena-zk-snarks',
    tier: 'Veteran',
    xpPoints: 14800,
    nextTierXp: 15000,
    rankPosition: 9,
    totalHackathonsAttended: 7,
    badgeHash: 'sha256:22446688001133557799bbddffaaee00',
    radarSkills: [
      { category: 'AI/ML Systems', score: 68, maxScore: 100, verifiedCommits: 90 },
      { category: 'Systems & Rust', score: 91, maxScore: 100, verifiedCommits: 380 },
      { category: 'Frontend & UI', score: 60, maxScore: 100, verifiedCommits: 70 },
      { category: 'Distributed Sys', score: 84, maxScore: 100, verifiedCommits: 190 },
      { category: 'Web3 & Security', score: 99, maxScore: 100, verifiedCommits: 590 },
      { category: 'DevOps & Cloud', score: 76, maxScore: 100, verifiedCommits: 110 },
    ],
    activityMatrix: [],
    stamps: [],
    trophies: [],
    vouches: [],
  },
];

class ReactiveStore {
  private listeners: Set<() => void> = new Set();

  private load<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Fallback on error
    }
    return defaultValue;
  }

  private save<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage quota exceeded or disabled', e);
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in store listener', err);
      }
    });
  }

  // User Profile Methods
  public getUser(): UserProfile {
    return this.load<UserProfile>(STORAGE_KEYS.USER_PROFILE, INITIAL_AUTH_USER);
  }

  public updateUser(partial: Partial<UserProfile>): UserProfile {
    const current = this.getUser();
    const updated = { ...current, ...partial };
    this.save(STORAGE_KEYS.USER_PROFILE, updated);
    return updated;
  }

  // Connections Methods
  public getConnections(): Connection[] {
    return this.load<Connection[]>(STORAGE_KEYS.CONNECTIONS, INITIAL_CONNECTIONS);
  }

  public addConnection(
    peerProfile: UserProfile,
    privateNotes: string,
    tags: string[],
    scanLatencyMs = 320,
    eventMet = 'Genesis Hacks 2026'
  ): Connection {
    const connections = this.getConnections();
    // Check if connection already exists, if so update it
    const existingIndex = connections.findIndex((c) => c.peerProfile.id === peerProfile.id);

    const newConnection: Connection = {
      id: existingIndex >= 0 ? connections[existingIndex].id : `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      peerProfile,
      timestamp: new Date().toISOString(),
      privateNotes: privateNotes.trim(),
      tags: tags.length > 0 ? tags : ['Genesis 2026', peerProfile.primaryRole],
      eventMet,
      scanLatencyMs,
    };

    if (existingIndex >= 0) {
      connections[existingIndex] = newConnection;
    } else {
      connections.unshift(newConnection);
    }

    this.save(STORAGE_KEYS.CONNECTIONS, connections);
    return newConnection;
  }

  public updateConnection(id: string, updates: Partial<Connection>): Connection | null {
    const connections = this.getConnections();
    const index = connections.findIndex((c) => c.id === id);
    if (index === -1) return null;

    connections[index] = { ...connections[index], ...updates };
    this.save(STORAGE_KEYS.CONNECTIONS, connections);
    return connections[index];
  }

  public deleteConnection(id: string): boolean {
    const connections = this.getConnections();
    const filtered = connections.filter((c) => c.id !== id);
    if (filtered.length !== connections.length) {
      this.save(STORAGE_KEYS.CONNECTIONS, filtered);
      return true;
    }
    return false;
  }

  // Community Feed Methods
  public getFeed(): EventFeedItem[] {
    return this.load<EventFeedItem[]>(STORAGE_KEYS.COMMUNITY_FEED, INITIAL_COMMUNITY_FEED);
  }

  public toggleRsvp(feedItemId: string): EventFeedItem | null {
    const feed = this.getFeed();
    const index = feed.findIndex((f) => f.id === feedItemId);
    if (index === -1) return null;

    const item = feed[index];
    const isRsvpd = !item.isRsvpd;
    const rsvpCount = (item.rsvpCount || 0) + (isRsvpd ? 1 : -1);

    feed[index] = { ...item, isRsvpd, rsvpCount: Math.max(0, rsvpCount) };
    this.save(STORAGE_KEYS.COMMUNITY_FEED, feed);
    return feed[index];
  }

  // Generate Ephemeral Compact QR Payload for User (<200 bytes for instant decode)
  public generateQrPayload(user: UserProfile): QrPayload {
    const nonce = Math.random().toString(36).substring(2, 8);
    const timestamp = Date.now();
    return {
      version: '2.0',
      type: 'profile_share',
      userId: user.id,
      handle: user.handle,
      name: user.name,
      primaryRole: user.primaryRole,
      tier: user.tier,
      badgeHash: user.badgeHash ? user.badgeHash.substring(0, 32) : 'sha256:gen2026',
      timestamp,
      nonce,
      signature: `sig_${user.id.slice(-6)}_${nonce}`,
    };
  }

  // Mock Peers for testing scanner
  public getMockPeers(): UserProfile[] {
    return MOCK_TEST_PEERS;
  }
}

export const store = new ReactiveStore();
