/**
 * The real entry point (src/index.ts) as a child process on a file-backed PGlite: it boots and serves
 * /api/health, shuts down cleanly on SIGTERM, and releases the database (lock file) when startup fails.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { SERVER_ROOT } from '../src/paths';
import { TEST_SECRETS } from './helpers';

const root = mkdtempSync(path.join(tmpdir(), 'loopin-entry-'));
const children = new Set<ChildProcess>();
// A failed assertion must not leave a server running.
afterEach(() => {
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  children.clear();
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

function listenOn(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    // No host: the same wildcard address the API binds, so the port really is taken for it.
    server.listen(port, () => resolve(server));
  });
}

async function freePort(): Promise<number> {
  const server = await listenOn(0);
  const address = server.address();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (typeof address !== 'object' || address === null) throw new Error('no port');
  return address.port;
}

function startServer(port: number, pgliteDir: string) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: SERVER_ROOT,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      PORT: String(port),
      PGLITE_DIR: pgliteDir,
      DATABASE_URL: '',
      SERVE_WEB: 'false',
      ...TEST_SECRETS,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  return { child, exited, output: () => output };
}

describe('src/index.ts', () => {
  it('boots, serves /api/health and shuts down cleanly on SIGTERM', async () => {
    const port = await freePort();
    const dir = path.join(root, 'ok');
    const server = startServer(port, dir);
    let health: Response | undefined;
    for (let attempt = 0; attempt < 150 && !health; attempt++) {
      health = await fetch(`http://127.0.0.1:${port}/api/health`).catch(() => undefined);
      if (!health) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(health?.status, server.output()).toBe(200);
    expect(await health?.json()).toMatchObject({ status: 'ok', db: 'ok' });
    expect(existsSync(`${dir}.lock`)).toBe(true);

    server.child.kill('SIGTERM');
    expect(await server.exited).toBe(0);
    expect(server.output()).toMatch(/Shutdown complete/);
    expect(existsSync(`${dir}.lock`)).toBe(false);
  });

  it('exits 1 and releases the database when it cannot listen', async () => {
    const port = await freePort();
    const blocker = await listenOn(port);
    try {
      const dir = path.join(root, 'busy');
      const server = startServer(port, dir);
      expect(await server.exited).toBe(1);
      expect(server.output()).toMatch(/Loopin failed to start/);
      expect(server.output()).toMatch(/EADDRINUSE/);
      expect(existsSync(dir)).toBe(true);
      expect(existsSync(`${dir}.lock`)).toBe(false);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });
});
