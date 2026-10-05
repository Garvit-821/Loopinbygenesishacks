import { describe, expect, it } from 'vitest';
import { escapeVCardText, foldLine, toVCard, toVCards, vcardFileName, vcardFromPeer } from './vcard';

const encoder = new TextEncoder();
const octets = (line: string) => encoder.encode(line).length;
const unfold = (text: string) => text.replace(/\r\n /g, '');

describe('escapeVCardText', () => {
  it('escapes backslashes, commas, semicolons and every kind of line break', () => {
    expect(escapeVCardText('a\\b')).toBe('a\\\\b');
    expect(escapeVCardText('Bengaluru, India; HSR')).toBe('Bengaluru\\, India\\; HSR');
    expect(escapeVCardText('one\r\ntwo\rthree\nfour')).toBe('one\\ntwo\\nthree\\nfour');
  });
});

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('FN:Ada Lovelace')).toBe('FN:Ada Lovelace');
  });

  it('folds long lines at 75 octets with a leading space on continuations', () => {
    const line = `NOTE:${'x'.repeat(200)}`;
    const folded = foldLine(line);
    const physical = folded.split('\r\n');
    expect(physical.length).toBeGreaterThan(1);
    expect(physical[0]).toHaveLength(75);
    for (const continuation of physical.slice(1)) {
      expect(continuation.startsWith(' ')).toBe(true);
      expect(octets(continuation)).toBeLessThanOrEqual(75);
    }
    expect(unfold(folded)).toBe(line);
  });

  it('counts UTF-8 octets and never splits a character', () => {
    const line = `NOTE:${'é'.repeat(60)}${'🚀'.repeat(20)}`;
    const folded = foldLine(line);
    for (const physical of folded.split('\r\n')) {
      expect(octets(physical)).toBeLessThanOrEqual(75);
      expect(physical).not.toContain('\uFFFD');
    }
    expect(unfold(folded)).toBe(line);
  });
});

describe('toVCard', () => {
  it('writes a vCard 3.0 with CRLF line endings and only the fields that are present', () => {
    const card = toVCard({
      name: 'Ana Kovač',
      nickname: '@ana',
      title: 'Rust, WASM; systems',
      emails: ['ana@example.com', null, ''],
      phones: [undefined],
      urls: ['https://ana.dev', 'javascript:alert(1)', null],
      note: 'Met at Genesis Hacks\nTalk about compilers',
    });
    expect(card.endsWith('\r\n')).toBe(true);
    expect(card.split('\r\n')).toEqual([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Ana Kovač',
      'N:Kovač;Ana;;;',
      'NICKNAME:@ana',
      'TITLE:Rust\\, WASM\\; systems',
      'EMAIL;TYPE=INTERNET:ana@example.com',
      'URL:https://ana.dev/',
      'NOTE:Met at Genesis Hacks\\nTalk about compilers',
      'END:VCARD',
      '',
    ]);
  });

  it('puts single-word names in the given-name slot', () => {
    expect(toVCard({ name: 'Prince' })).toContain('N:;Prince;;;\r\n');
  });

  it('combines several cards in one file', () => {
    const file = toVCards([{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }, { name: 'Alan Turing' }]);
    expect(file.match(/BEGIN:VCARD/g)).toHaveLength(3);
    expect(file.match(/END:VCARD\r\n/g)).toHaveLength(3);
  });
});

describe('vcardFromPeer', () => {
  const peer = {
    name: 'Rohan Mehta',
    handle: 'rohan_sys',
    headline: 'Systems engineer',
    githubUsername: 'rohan-m',
    linkedinUrl: 'https://www.linkedin.com/in/rohan',
    websiteUrl: null,
    contact: null,
  };

  it('leaves out contact details the API did not share', () => {
    const card = toVCard(vcardFromPeer(peer, { profileUrl: 'https://loopin.example/u/rohan_sys' }));
    expect(card).not.toContain('EMAIL');
    expect(card).not.toContain('TEL');
    expect(card).toContain('NICKNAME:@rohan_sys\r\n');
    expect(card).toContain('URL:https://loopin.example/u/rohan_sys\r\n');
    expect(card).toContain('URL:https://github.com/rohan-m\r\n');
  });

  it('includes contact details for mutual connections', () => {
    const card = toVCard(vcardFromPeer({ ...peer, contact: { contactEmail: 'rohan@example.com', phone: '+91 98450 00000' } }));
    expect(card).toContain('EMAIL;TYPE=INTERNET:rohan@example.com\r\n');
    expect(card).toContain('TEL;TYPE=CELL:+91 98450 00000\r\n');
  });
});

describe('vcardFileName', () => {
  it('makes a safe ASCII file name', () => {
    expect(vcardFileName('Ana Kovač')).toBe('ana-kovac.vcf');
    expect(vcardFileName('李雷')).toBe('contact.vcf');
  });
});
