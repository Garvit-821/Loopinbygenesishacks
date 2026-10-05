/**
 * Filesystem locations. Everything is anchored at the server package root (found by walking up from this
 * module to the package.json named "@loopin/server"), never process.cwd(), so the same paths work from
 * `tsx src/…`, from the bundled `dist/…` and from npm workspace scripts started in any directory.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@loopin/server';

function findServerPackage(startDir: string): { root: string; version: string } {
  let dir = startDir;
  for (;;) {
    const manifest = path.join(dir, 'package.json');
    if (existsSync(manifest)) {
      const pkg = readManifest(manifest);
      if (pkg?.name === PACKAGE_NAME) return { root: dir, version: typeof pkg.version === 'string' ? pkg.version : '0.0.0' };
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Could not find the ${PACKAGE_NAME} package.json above ${startDir}`);
    dir = parent;
  }
}

function readManifest(file: string): { name?: unknown; version?: unknown } | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as { name?: unknown; version?: unknown };
  } catch {
    return null;
  }
}

const serverPackage = findServerPackage(path.dirname(fileURLToPath(import.meta.url)));

/** Absolute path of the `server/` package directory. */
export const SERVER_ROOT = serverPackage.root;
/** `version` from server/package.json (reported by GET /api/health). */
export const SERVER_VERSION = serverPackage.version;
/** Generated SQL migrations (drizzle-kit output). */
export const MIGRATIONS_DIR = path.join(SERVER_ROOT, 'drizzle');
/** Local, git-ignored state: embedded database, development secrets, lock files. */
export const DATA_DIR = path.join(SERVER_ROOT, '.data');
export const DEFAULT_PGLITE_DIR = path.join(DATA_DIR, 'pglite');
/** The web app's production build (repo-root `dist/`). */
export const DEFAULT_WEB_DIST_DIR = path.resolve(SERVER_ROOT, '..', 'dist');

/**
 * Resolve a path from configuration: absolute paths are kept, relative ones are relative to SERVER_ROOT.
 * Trailing separators are dropped ("/data/pglite/" → "/data/pglite"), so sibling paths such as the PGlite lock
 * file (`${dir}.lock`) land next to the directory, never inside it.
 */
export function resolveServerPath(value: string): string {
  return path.resolve(SERVER_ROOT, value);
}
