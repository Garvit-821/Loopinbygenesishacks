/** RFC 4180 CSV for exports, with a guard against spreadsheet formula injection. */

export type CsvCell = string | number | boolean | null | undefined;

export const CSV_MIME = 'text/csv;charset=utf-8';

const CRLF = '\r\n';
/** Spreadsheets run cells that start with these as formulas (or strip them), so user text gets a leading quote. */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

/** One field: strings that look like formulas get a leading `'`; fields with quotes, commas or line breaks are quoted. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Numbers and booleans are data, never formulas: "-5" stays a negative number.
  if (typeof value === 'string' && FORMULA_TRIGGER.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvOptions {
  /** Prefix a UTF-8 byte order mark so Excel reads non-ASCII names correctly. Use it for downloaded files. */
  bom?: boolean;
}

/** Rows (the first is usually the header) → CSV text with CRLF line endings. */
export function toCsv(rows: readonly (readonly CsvCell[])[], options: CsvOptions = {}): string {
  const body = rows.map((row) => row.map(csvCell).join(',')).join(CRLF);
  return `${options.bom ? '\uFEFF' : ''}${body}${rows.length > 0 ? CRLF : ''}`;
}
