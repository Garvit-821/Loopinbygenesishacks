/**
 * Request validation. Every body, query string and id parameter goes through one of these; failures become
 * 400 validation_error with `fields` (or 404 not_found for malformed ids, which never reach the database).
 */
import type { Request } from 'express';
import type { z } from 'zod';
import { issuesToFields, isUuid } from '@loopin/shared';
import { notFound, validationError } from './errors';

function parseWith<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw validationError(issuesToFields(result.error.issues));
  return result.data;
}

/** Validate `req.body` (Express 5 leaves it undefined when there is no body, so that is treated as `{}`). */
export function parseBody<S extends z.ZodType>(schema: S, req: Request): z.output<S> {
  return parseWith(schema, req.body ?? {});
}

/** Validate the query string and return the parsed value (never assign to `req.query`, it is a getter). */
export function parseQuery<S extends z.ZodType>(schema: S, req: Request): z.output<S> {
  return parseWith(schema, req.query);
}

/** A route `:param` that must be a UUID; anything else is 404 not_found. Returned lowercased. */
export function idParam(req: Request, name = 'id', message?: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !isUuid(value)) throw notFound(message);
  return value.toLowerCase();
}
