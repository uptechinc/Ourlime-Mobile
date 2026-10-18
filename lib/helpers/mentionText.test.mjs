import { describe, expect, test } from 'bun:test';

const { findActiveMention, insertMention, extractMentionUserNames, rankMentionMatches } = await import('./mentionText.ts');

const people = [
  { id: '1', userName: 'rishi06', firstName: 'Rishi', lastName: 'Kowlessar' },
  { id: '2', userName: 'chris', firstName: 'Chris', lastName: 'Walker' },
  { id: '3', userName: 'kai_r', firstName: 'Kai', lastName: 'Rishton' },
  { id: '4', userName: 'ron', firstName: 'Aaron', lastName: 'Hazzard' },
];

describe('findActiveMention', () => {
  test('finds the "@word" right before the cursor', () => {
    expect(findActiveMention('hi @ri', 6)).toEqual({ query: 'ri', start: 3, end: 6 });
    expect(findActiveMention('@', 1)).toEqual({ query: '', start: 0, end: 1 });
    expect(findActiveMention('line one\n@kai', 13)).toEqual({ query: 'kai', start: 9, end: 13 });
    expect(findActiveMention('(@chris', 7)).toEqual({ query: 'chris', start: 1, end: 7 });
  });

  test('a plain word after an earlier mention is not a mention (the old picker popped up for every word)', () => {
    expect(findActiveMention('hello @bob how are you', 23)).toBeNull();
    expect(findActiveMention('hello @bob ', 11)).toBeNull();
  });

  test('emails and mid-word "@" are not mentions', () => {
    expect(findActiveMention('mail me a@b.com', 15)).toBeNull();
    expect(findActiveMention('abc@def', 7)).toBeNull();
  });

  test('only the text before the cursor counts, and a stale cursor is clamped', () => {
    expect(findActiveMention('hi @ri and more', 6)).toEqual({ query: 'ri', start: 3, end: 6 });
    expect(findActiveMention('hi @ri', 99)).toEqual({ query: 'ri', start: 3, end: 6 });
    expect(findActiveMention('hi @ri', -4)).toBeNull();
  });

  test('queries longer than 30 characters stop matching', () => {
    expect(findActiveMention(`@${'a'.repeat(30)}`, 31)?.query.length).toBe(30);
    expect(findActiveMention(`@${'a'.repeat(31)}`, 32)).toBeNull();
  });
});

describe('insertMention', () => {
  test('replaces the typed "@que" and puts the cursor after the added space', () => {
    const mention = findActiveMention('hi @ri', 6);
    expect(insertMention('hi @ri', mention, 'rishi06')).toEqual({ text: 'hi @rishi06 ', cursor: 12 });
  });

  test('keeps the text after the cursor and does not double a following space', () => {
    const mention = findActiveMention('hi @ri there', 6);
    expect(insertMention('hi @ri there', mention, 'rishi06')).toEqual({ text: 'hi @rishi06 there', cursor: 12 });
    const glued = findActiveMention('hi @ri!', 6);
    expect(insertMention('hi @ri!', glued, 'rishi06')).toEqual({ text: 'hi @rishi06 !', cursor: 12 });
  });

  test('works for a bare "@" at the start', () => {
    expect(insertMention('@', findActiveMention('@', 1), 'chris')).toEqual({ text: '@chris ', cursor: 7 });
  });
});

describe('extractMentionUserNames', () => {
  test('lists unique, lowercased usernames', () => {
    expect(extractMentionUserNames('hey @Rishi06 and @chris, @rishi06 again')).toEqual(['rishi06', 'chris']);
  });

  test('ignores emails and trailing punctuation', () => {
    expect(extractMentionUserNames('write a@b.com or ask @kai_r.')).toEqual(['kai_r']);
    expect(extractMentionUserNames('')).toEqual([]);
    expect(extractMentionUserNames('no mentions here')).toEqual([]);
  });

  test('caps at 25', () => {
    const text = Array.from({ length: 40 }, (_, index) => `@user${index}`).join(' ');
    expect(extractMentionUserNames(text)).toHaveLength(25);
  });
});

describe('rankMentionMatches', () => {
  test('keeps everyone for an empty query', () => {
    expect(rankMentionMatches(people, '')).toHaveLength(4);
  });

  test('username prefix first, then name prefix, then contains', () => {
    // rishi06 (username starts with ri), kai_r (last name Rishton starts with ri), chris (only contains ri)
    expect(rankMentionMatches(people, 'ri').map((person) => person.userName)).toEqual(['rishi06', 'kai_r', 'chris']);
    expect(rankMentionMatches(people, 'ron').map((person) => person.userName)).toEqual(['ron']);
    expect(rankMentionMatches(people, 'ron')[0].userName).toBe('ron');
    expect(rankMentionMatches(people, 'zzz')).toEqual([]);
  });

  test('matches on first or last name', () => {
    expect(rankMentionMatches(people, 'walk').map((person) => person.id)).toEqual(['2']);
    expect(rankMentionMatches(people, 'KAI').map((person) => person.id)).toEqual(['3']);
  });
});
