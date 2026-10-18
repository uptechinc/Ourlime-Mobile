/** Pure text rules for @mentions (same pattern the website uses), so the app and web read the same text the same way. */

export type ActiveMention = {
  /** What was typed after the "@" (may be empty right after typing "@"). */
  query: string;
  /** Index of the "@" in the text. */
  start: number;
  /** Index just after the typed query (the cursor). */
  end: number;
};

export type MentionInsertion = {
  text: string;
  /** Where the cursor goes: right after the inserted mention and its space. */
  cursor: number;
};

export type MentionPerson = {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
};

export const MAX_MENTIONS_PER_TEXT = 25;
const MAX_QUERY_LENGTH = 30;
/** An "@" starts a mention only at the start of the text or after whitespace / an opening bracket (not in "a@b.com"). */
const ACTIVE_MENTION_PATTERN = new RegExp(`(?:^|[\\s(])@([\\w.-]{0,${MAX_QUERY_LENGTH}})$`);

/** The "@word" being typed right before the cursor, or null when the cursor isn't in a mention. */
export function findActiveMention(text: string, cursor: number): ActiveMention | null {
  const end = Math.max(0, Math.min(cursor, text.length));
  const match = text.slice(0, end).match(ACTIVE_MENTION_PATTERN);
  if (!match) return null;
  return { query: match[1], start: end - match[1].length - 1, end };
}

/** Replaces the typed "@que" with "@userName " and returns the new text and cursor. */
export function insertMention(text: string, mention: ActiveMention, userName: string): MentionInsertion {
  const before = text.slice(0, mention.start);
  const after = text.slice(mention.end);
  // Don't add a second space when one already follows.
  const needsSpace = !/^\s/.test(after);
  const inserted = `@${userName}${needsSpace ? ' ' : ''}`;
  return { text: `${before}${inserted}${after}`, cursor: before.length + inserted.length + (needsSpace ? 0 : 1) };
}

/** Every @userName in the text, lowercased and unique (at most 25, like the server). */
export function extractMentionUserNames(content: string): string[] {
  if (!content) return [];
  const names = Array.from(content.matchAll(/(?:^|[\s(])@([\w.-]+)/g), (match) => match[1].replace(/[.-]+$/, '').toLowerCase());
  return [...new Set(names.filter(Boolean))].slice(0, MAX_MENTIONS_PER_TEXT);
}

/** Orders people for the picker: username starts with the query, then name starts with it, then anything that contains it. */
export function rankMentionMatches<TPerson extends MentionPerson>(people: TPerson[], query: string): TPerson[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return people;
  const scored = people.flatMap((person): Array<{ person: TPerson; score: number }> => {
    const userName = person.userName.toLowerCase();
    const fullName = `${person.firstName} ${person.lastName}`.trim().toLowerCase();
    if (userName.startsWith(needle)) return [{ person, score: 0 }];
    if (person.firstName.toLowerCase().startsWith(needle) || person.lastName.toLowerCase().startsWith(needle)) return [{ person, score: 1 }];
    if (userName.includes(needle) || fullName.includes(needle)) return [{ person, score: 2 }];
    return [];
  });
  return scored.sort((left, right) => left.score - right.score).map((entry) => entry.person);
}
