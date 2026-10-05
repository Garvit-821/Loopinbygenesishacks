import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FixtureContext, FixtureHandler, FixtureHandlers, FixtureResult } from './types';

interface CompiledRoute {
  key: string;
  method: string;
  pattern: RegExp;
  paramNames: string[];
  staticSegments: number;
  handler: FixtureHandler;
  source: string;
}

export interface FixtureRouter {
  /** Number of registered handler keys. */
  size: number;
  files: string[];
  resolve: (method: string, pathname: string) => { route: CompiledRoute; params: Record<string, string> } | null;
}

function compile(key: string, handler: FixtureHandler, source: string): CompiledRoute {
  const match = /^(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/\S*)$/.exec(key.trim());
  if (!match) throw new Error(`${source}: invalid fixture key "${key}" (expected "METHOD /api/path")`);
  const [, method, path] = match;
  const paramNames: string[] = [];
  let staticSegments = 0;
  const regex = path
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      }
      if (segment) staticSegments += 1;
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { key: `${method} ${path}`, method, pattern: new RegExp(`^${regex}/?$`), paramNames, staticSegments, handler, source };
}

/**
 * Loads every `fixtures/*.ts` module (base.ts first, then the rest alphabetically). Each must export
 * `handlers: FixtureHandlers`; a later file's handler replaces an earlier one with the same key.
 */
export async function loadFixtures(directory: string): Promise<FixtureRouter> {
  const files = (await readdir(directory))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
    .sort((a, b) => (a === 'base.ts' ? -1 : b === 'base.ts' ? 1 : a.localeCompare(b)));
  const routes = new Map<string, CompiledRoute>();
  for (const file of files) {
    const module = (await import(pathToFileURL(join(directory, file)).href)) as { handlers?: FixtureHandlers };
    if (!module.handlers) throw new Error(`fixtures/${file} must export "handlers"`);
    for (const [key, handler] of Object.entries(module.handlers)) {
      const route = compile(key, handler, file);
      routes.set(route.key, route);
    }
  }
  // More static segments first, so '/api/events/:id/stats' never loses to a looser pattern.
  const ordered = [...routes.values()].sort((a, b) => b.staticSegments - a.staticSegments || a.paramNames.length - b.paramNames.length);
  return {
    size: ordered.length,
    files,
    resolve(method, pathname) {
      for (const route of ordered) {
        if (route.method !== method) continue;
        const found = route.pattern.exec(pathname);
        if (!found) continue;
        const params = Object.fromEntries(route.paramNames.map((name, index) => [name, decodeURIComponent(found[index + 1])]));
        return { route, params };
      }
      return null;
    },
  };
}

export async function runHandler(handler: FixtureHandler, context: FixtureContext): Promise<FixtureResult> {
  const result = await handler(context);
  if (result.delayMs) await new Promise((resolve) => setTimeout(resolve, result.delayMs));
  return result;
}
