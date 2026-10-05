import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { errorMessage, isApiError } from './api-error';

/** The parts of a react-hook-form `useForm()` result this needs (pass the form itself). */
interface ServerErrorTarget<T extends FieldValues> {
  setError: UseFormSetError<T>;
  getValues: () => T;
}

function hasPath(values: unknown, path: string): boolean {
  let current = values;
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object' || !(key in current)) return false;
    current = (current as Record<string, unknown>)[key];
  }
  return true;
}

/**
 * Show an API error on a react-hook-form form. Each `fields` entry goes to its input (the first one gets focus);
 * '_' and fields the form doesn't have go to `errors.root.server`, and so does the message of any other error.
 * Give every field a default value so its path is known. Returns true when at least one input got an error.
 */
export function applyServerErrors<T extends FieldValues>(form: ServerErrorTarget<T>, error: unknown): boolean {
  const formMessages: string[] = [];
  let fieldErrorSet = false;
  if (isApiError(error) && error.fields && Object.keys(error.fields).length > 0) {
    const values = form.getValues();
    for (const [path, message] of Object.entries(error.fields)) {
      if (path !== '_' && hasPath(values, path)) {
        form.setError(path as Path<T>, { type: 'server', message }, { shouldFocus: !fieldErrorSet });
        fieldErrorSet = true;
      } else {
        formMessages.push(message);
      }
    }
  } else {
    formMessages.push(errorMessage(error));
  }
  if (formMessages.length > 0) form.setError('root.server', { type: 'server', message: formMessages.join(' ') });
  return fieldErrorSet;
}

function isDirtyMarker(value: unknown): boolean {
  if (value === true) return true;
  if (Array.isArray(value)) return value.some(isDirtyMarker);
  if (value !== null && typeof value === 'object') return Object.values(value).some(isDirtyMarker);
  return false;
}

/**
 * The top-level fields of `values` that the user changed, for PATCH requests that send dirty fields only.
 * Pass react-hook-form's `formState.dirtyFields`; a nested change (one skill in a list) sends the whole field.
 */
export function dirtyValues<T extends Record<string, unknown>>(values: T, dirtyFields: Partial<Record<keyof T, unknown>>): Partial<T> {
  const changed: Partial<T> = {};
  for (const key of Object.keys(dirtyFields) as (keyof T)[]) {
    if (isDirtyMarker(dirtyFields[key])) changed[key] = values[key];
  }
  return changed;
}
