import { UserProfile } from '../types';

/**
 * Generates an RFC 2426 compliant vCard 3.0 string for importing directly into iOS/Android Contacts
 */
export function generateVCard(
  peer: UserProfile,
  eventMet = 'Genesis Hacks 2026',
  privateNotes = ''
): string {
  const nameParts = peer.name.trim().split(' ');
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : peer.name;

  const noteContent = [
    `Role: ${peer.primaryRole}`,
    `Tier: ${peer.tier}`,
    `Met at: ${eventMet}`,
    `Handle: ${peer.handle}`,
    `Passport Hash: ${peer.badgeHash}`,
    privateNotes ? `Notes: ${privateNotes}` : '',
  ]
    .filter(Boolean)
    .join(' \\n');

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${peer.name}`,
    `TITLE:${peer.primaryRole}`,
    `ORG:Genesis Hacks Ecosystem;`,
    peer.githubUsername ? `URL;TYPE=GitHub:https://github.com/${peer.githubUsername}` : '',
    peer.linkedinUrl ? `URL;TYPE=LinkedIn:${peer.linkedinUrl}` : '',
    peer.portfolioUrl ? `URL;TYPE=Portfolio:${peer.portfolioUrl}` : '',
    `NOTE:${noteContent}`,
    'END:VCARD',
  ];

  return lines.filter(Boolean).join('\r\n');
}

/**
 * Prompts native mobile or browser download of .vcf contact card
 */
export function downloadVCard(
  peer: UserProfile,
  eventMet = 'Genesis Hacks 2026',
  privateNotes = ''
): void {
  const vcardText = generateVCard(peer, eventMet, privateNotes);
  const blob = new Blob([vcardText], { type: 'text/vcard;charset=utf-8' });
  const filename = `${peer.name.replace(/\s+/g, '_')}_GenesisPass.vcf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
