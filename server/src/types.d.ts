import type { SessionRow, UserRow } from './db/schema';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate` when a valid, unexpired bearer session is presented. */
      user?: UserRow;
      /** Id of that session (for logout, stream bookkeeping and "other sessions" operations). */
      sessionId?: string;
      /** The full session row (createdAt is needed for "signed in within the last 10 minutes" checks). */
      session?: SessionRow;
    }
  }
}

export {};
