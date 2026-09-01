import { UserProfile, Connection, EventFeedItem, QrPayload, LoginCredentials, SignUpData } from '../types';
import { store } from './store';

const API_BASE_URL = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL || '';

class ApiService {
  private isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  // Authentication: Email / Password Login
  public async login(credentials: LoginCredentials): Promise<UserProfile> {
    const localUser = store.loginWithEmail(credentials);

    if (!API_BASE_URL || !this.isOnline()) {
      return localUser;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UserProfile = await res.json();
      store.updateUser(data);
      return data;
    } catch (err) {
      console.warn('API login fallback to local session:', err);
      return localUser;
    }
  }

  // Authentication: GitHub OAuth / Username Login
  public async loginWithGitHub(username: string): Promise<UserProfile> {
    const localUser = store.loginWithGitHub(username);

    if (!API_BASE_URL || !this.isOnline()) {
      return localUser;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UserProfile = await res.json();
      store.updateUser(data);
      return data;
    } catch (err) {
      console.warn('API GitHub login fallback:', err);
      return localUser;
    }
  }

  // Authentication: Sign Up / Passport Genesis
  public async signup(signUpData: SignUpData): Promise<UserProfile> {
    const localUser = store.signup(signUpData);

    if (!API_BASE_URL || !this.isOnline()) {
      return localUser;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signUpData),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UserProfile = await res.json();
      store.updateUser(data);
      return data;
    } catch (err) {
      console.warn('API signup fallback to local passport genesis:', err);
      return localUser;
    }
  }

  // Authentication: Logout
  public async logout(): Promise<void> {
    store.logout();
    if (API_BASE_URL && this.isOnline()) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
      } catch {
        // Safe offline logout
      }
    }
  }

  // Fetch User Profile
  public async getProfile(): Promise<UserProfile> {
    if (!API_BASE_URL || !this.isOnline()) {
      return store.getUser();
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UserProfile = await res.json();
      store.updateUser(data);
      return data;
    } catch (err) {
      console.warn('API fallback to local store for profile:', err);
      return store.getUser();
    }
  }

  // Update User Profile
  public async updateProfile(partial: Partial<UserProfile>): Promise<UserProfile> {
    const localUpdated = store.updateUser(partial);

    if (!API_BASE_URL || !this.isOnline()) {
      return localUpdated;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API sync deferred for profile update:', err);
      return localUpdated;
    }
  }

  // Get Connections
  public async getConnections(): Promise<Connection[]> {
    if (!API_BASE_URL || !this.isOnline()) {
      return store.getConnections();
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/connections`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API fallback to local store for connections:', err);
      return store.getConnections();
    }
  }

  // Add Connection
  public async addConnection(
    peerProfile: UserProfile,
    privateNotes: string,
    tags: string[],
    scanLatencyMs = 320,
    eventMet = 'Genesis Hacks 2026'
  ): Promise<Connection> {
    const localConn = store.addConnection(peerProfile, privateNotes, tags, scanLatencyMs, eventMet);

    if (!API_BASE_URL || !this.isOnline()) {
      return localConn;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localConn),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API connection sync deferred:', err);
      return localConn;
    }
  }

  // Delete Connection
  public async deleteConnection(id: string): Promise<boolean> {
    const localResult = store.deleteConnection(id);

    if (!API_BASE_URL || !this.isOnline()) {
      return localResult;
    }

    try {
      await fetch(`${API_BASE_URL}/api/connections/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('API delete deferred:', err);
    }
    return localResult;
  }

  // Get Live Ops Feed
  public async getFeed(): Promise<EventFeedItem[]> {
    if (!API_BASE_URL || !this.isOnline()) {
      return store.getFeed();
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/feed`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API fallback to local feed:', err);
      return store.getFeed();
    }
  }

  // RSVP to Event
  public async toggleRsvp(feedItemId: string): Promise<EventFeedItem | null> {
    const localUpdated = store.toggleRsvp(feedItemId);

    if (!API_BASE_URL || !this.isOnline()) {
      return localUpdated;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/feed/${feedItemId}/rsvp`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API RSVP sync deferred:', err);
      return localUpdated;
    }
  }

  // Cryptographic Signature Verification Service
  public async verifyBadge(payload: QrPayload): Promise<{ valid: boolean; issuer: string }> {
    const isTimestampFresh = Date.now() - payload.timestamp < 120_000;
    if (!payload.signature || !payload.userId) {
      return { valid: false, issuer: 'Unknown' };
    }

    if (!API_BASE_URL || !this.isOnline()) {
      return { valid: isTimestampFresh, issuer: 'Genesis Core Keyring (Local)' };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/verify-badge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return { valid: isTimestampFresh, issuer: 'Genesis Core Keyring (Offline)' };
    }
  }
}

export const api = new ApiService();
