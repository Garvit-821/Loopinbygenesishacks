/**
 * `npm run admin:grant -- <email|handle> [role]` — set an account's role (default admin) in the configured
 * database. Production: `node server/dist/scripts/grant-role.js <email|handle> [role]`.
 */
import { eq } from 'drizzle-orm';
import { USER_ROLES, type UserRole } from '@loopin/shared';
import type { Executor } from '../context';
import { createDb } from '../db/client';
import { users } from '../db/schema';
import { loadDatabaseEnv, loadDotEnvFile } from '../env';
import { createLogger } from '../lib/logger';
import { ScriptError, runScript } from './run';

const ROLE_PHRASE: Record<UserRole, string> = { member: 'a member', organizer: 'an organizer', admin: 'an admin' };
const USAGE = `Usage: npm run admin:grant -- <email|handle> [${USER_ROLES.join('|')}]   (role defaults to admin)`;

function isRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

await runScript(async () => {
  const [identifier, roleArg = 'admin', ...extra] = process.argv.slice(2);
  if (!identifier || extra.length > 0) throw new ScriptError(USAGE);
  const role = roleArg.toLowerCase();
  if (!isRole(role)) throw new ScriptError(`Unknown role "${roleArg}".\n${USAGE}`);

  const value = identifier.trim().toLowerCase();
  const byEmail = value.includes('@') && !value.startsWith('@');
  const match = byEmail ? eq(users.email, value) : eq(users.handle, value.replace(/^@/, ''));

  loadDotEnvFile();
  const { env } = loadDatabaseEnv();
  const database = await createDb(env, createLogger(env));
  try {
    const ex: Executor = database.db;
    const [user] = await ex.update(users).set({ role }).where(match).returning({ handle: users.handle, email: users.email });
    if (!user) throw new ScriptError(`No account with ${byEmail ? 'email' : 'handle'} "${identifier}".`);
    console.log(`@${user.handle} (${user.email}) is now ${ROLE_PHRASE[role]}.`);
  } finally {
    await database.close();
  }
});
