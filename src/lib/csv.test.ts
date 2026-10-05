import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csvCell', () => {
  it('leaves plain values alone and renders empty values as nothing', () => {
    expect(csvCell('Ana Kovač')).toBe('Ana Kovač');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes fields with commas, quotes or line breaks and doubles inner quotes', () => {
    expect(csvCell('Bengaluru, India')).toBe('"Bengaluru, India"');
    expect(csvCell('She said "ship it"')).toBe('"She said ""ship it"""');
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"');
  });

  it('neutralises text that a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("https://evil.example")')).toBe('"\'=HYPERLINK(""https://evil.example"")"');
    expect(csvCell('+1 555 0100')).toBe("'+1 555 0100");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    // So export bare handles ("priya_builds"), not "@priya_builds".
    expect(csvCell('@priya_builds')).toBe("'@priya_builds");
    expect(csvCell('\tcmd')).toBe("'\tcmd");
    expect(csvCell('\rcmd')).toBe('"\'\rcmd"');
  });

  it('keeps real numbers numeric', () => {
    expect(csvCell(-5)).toBe('-5');
  });
});

describe('toCsv', () => {
  it('joins rows with CRLF and ends with a line break', () => {
    expect(
      toCsv([
        ['Name', 'Handle', 'Note'],
        ['Priya', 'priya_builds', 'Met at the "AI" track, great demo'],
      ]),
    ).toBe('Name,Handle,Note\r\nPriya,priya_builds,"Met at the ""AI"" track, great demo"\r\n');
  });

  it('optionally starts with a byte order mark for Excel', () => {
    expect(toCsv([['a']], { bom: true })).toBe('\uFEFFa\r\n');
    expect(toCsv([])).toBe('');
  });
});
