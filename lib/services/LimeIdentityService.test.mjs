import { describe, expect, test } from 'bun:test';
import { limeIdentityService } from './LimeIdentityService.ts';

describe('LimeIdentityService', () => {
  test('uses the record owner for an authored Lime', () => {
    expect(limeIdentityService.resolveAuthorUserId({
      recordOwnerUserId: 'author-1',
      isRepost: false,
      repostedFromUserId: 'ignored-source',
    })).toBe('author-1');
  });

  test('uses canonical repost attribution before embedded legacy identity', () => {
    expect(limeIdentityService.resolveAuthorUserId({
      recordOwnerUserId: 'reposter-1',
      isRepost: true,
      repostedFromUserId: 'original-author',
      embeddedUserId: 'legacy-author',
    })).toBe('original-author');
  });

  test('supports a legacy repost with only an embedded author id', () => {
    expect(limeIdentityService.resolveAuthorUserId({
      recordOwnerUserId: 'reposter-1',
      isRepost: true,
      embeddedUserId: 'legacy-author',
    })).toBe('legacy-author');
  });

  test('falls back to the record owner when legacy attribution is incomplete', () => {
    expect(limeIdentityService.resolveAuthorUserId({
      recordOwnerUserId: 'reposter-1',
      isRepost: true,
    })).toBe('reposter-1');
  });
});
