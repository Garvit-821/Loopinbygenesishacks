/**
 * Canonical JSON: object keys sorted (UTF-16 code unit order), no whitespace, `undefined` object members
 * omitted. Credentials are signed over exactly this string, so anyone can re-serialise and verify.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('canonicalJson: numbers must be finite');
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new TypeError(`canonicalJson: unsupported value of type ${typeof value}`);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`;
  }
  const withToJson = value as { toJSON?: () => unknown };
  if (typeof withToJson.toJSON === 'function') return canonicalJson(withToJson.toJSON());
  const record = value as Record<string, unknown>;
  const members = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
  return `{${members.join(',')}}`;
}
