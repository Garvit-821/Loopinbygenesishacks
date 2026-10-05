import { formatHandle, type ConnectionPeer } from '@loopin/shared';
import { safeHref } from './utils';

/** vCard 3.0 (RFC 2426) contact files: escaped text values, 75-octet line folding, CRLF line endings. */

export const VCARD_MIME = 'text/vcard;charset=utf-8';

const CRLF = '\r\n';
const MAX_LINE_OCTETS = 75;

export interface VCardContact {
  /** Display name (FN); also split into N for address-book sorting. */
  name: string;
  nickname?: string | null;
  /** Job title / headline. */
  title?: string | null;
  emails?: readonly (string | null | undefined)[];
  phones?: readonly (string | null | undefined)[];
  /** http(s) links; anything else is dropped. */
  urls?: readonly (string | null | undefined)[];
  note?: string | null;
}

/** Escape a TEXT value: backslash, comma, semicolon, and every kind of line break as `\n`. */
export function escapeVCardText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r\n|\r|\n/g, '\\n');
}

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** Fold a content line so no physical line exceeds 75 octets (continuations start with a space); never splits a character. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = utf8Length(char.codePointAt(0) ?? 0);
    // Continuation lines spend one octet on the leading space.
    const limit = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

function present(values: readonly (string | null | undefined)[] | undefined): string[] {
  return (values ?? []).map((value) => value?.trim() ?? '').filter((value) => value.length > 0);
}

/** "Ada Lovelace" → family "Lovelace", given "Ada". Single names go in the given-name slot. */
function structuredName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const family = words.length > 1 ? (words.pop() ?? '') : '';
  return [family, words.join(' '), '', '', ''].map(escapeVCardText).join(';');
}

export function toVCard(contact: VCardContact): string {
  const name = contact.name.trim();
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeVCardText(name)}`, `N:${structuredName(name)}`];
  if (contact.nickname?.trim()) lines.push(`NICKNAME:${escapeVCardText(contact.nickname.trim())}`);
  if (contact.title?.trim()) lines.push(`TITLE:${escapeVCardText(contact.title.trim())}`);
  for (const email of present(contact.emails)) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardText(email)}`);
  for (const phone of present(contact.phones)) lines.push(`TEL;TYPE=CELL:${escapeVCardText(phone)}`);
  for (const url of present(contact.urls)) {
    // URL is a URI value (not TEXT): commas and semicolons stay as they are.
    const href = safeHref(url);
    if (href) lines.push(`URL:${href}`);
  }
  if (contact.note?.trim()) lines.push(`NOTE:${escapeVCardText(contact.note.trim())}`);
  lines.push('END:VCARD');
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** Several contacts in one .vcf file (address books import them all at once). */
export function toVCards(contacts: readonly VCardContact[]): string {
  return contacts.map(toVCard).join('');
}

export interface PeerVCardOptions {
  /** Their Loopin passport link, e.g. publicUrl(`/u/${handle}`). */
  profileUrl?: string;
  note?: string | null;
}

/** A connection's card: contact details are included only when the API sent them (mutual connections). */
export function vcardFromPeer(
  peer: Pick<ConnectionPeer, 'name' | 'handle' | 'headline' | 'githubUsername' | 'linkedinUrl' | 'websiteUrl' | 'contact'>,
  options: PeerVCardOptions = {},
): VCardContact {
  return {
    name: peer.name,
    nickname: formatHandle(peer.handle),
    title: peer.headline || null,
    emails: [peer.contact?.contactEmail],
    phones: [peer.contact?.phone],
    urls: [
      options.profileUrl,
      peer.websiteUrl,
      peer.linkedinUrl,
      peer.githubUsername ? `https://github.com/${encodeURIComponent(peer.githubUsername)}` : null,
    ],
    note: options.note ?? null,
  };
}

/** "Ana Kovač" → "ana-kovac.vcf". */
export function vcardFileName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'contact'}.vcf`;
}
