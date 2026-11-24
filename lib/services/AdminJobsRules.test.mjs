import { describe, expect, test } from 'bun:test';

const rules = await import('./AdminJobsRules.ts');

describe('AdminJobsRules', () => {
  test('maps a job document and fills safe defaults for missing fields', () => {
    const job = rules.mapAdminJobDocument('job-1', { basic_info: { userId: 'u1', createdAt: { seconds: 5 } } });
    expect(job).toMatchObject({ id: 'job-1', title: 'Untitled', status: 'draft', type: 'professional', currency: 'USD', location: 'N/A', priceRange: null, skills: [], createdAtSeconds: 5, userId: 'u1' });
  });

  test('drops documents without basic_info and removed or deleted listings', () => {
    expect(rules.mapAdminJobDocument('a', {})).toBeNull();
    expect(rules.mapAdminJobDocument('b', { basic_info: 'bad' })).toBeNull();
    expect(rules.mapAdminJobDocument('c', { basic_info: { status: 'removed' } })).toBeNull();
    expect(rules.mapAdminJobDocument('d', { basic_info: { status: 'deleted' } })).toBeNull();
    expect(rules.mapAdminJobDocument('e', { basic_info: { status: 'rejected' } })?.status).toBe('rejected');
  });

  test('reads price range, location object and skills defensively', () => {
    const job = rules.mapAdminJobDocument('j', {
      basic_info: { priceRange: { from: '10', to: 20 }, location: { type: 'remote' } },
      details: { skills: ['ts', 3, null, 'rn'] },
    });
    expect(job?.priceRange).toEqual({ from: 10, to: 20 });
    expect(job?.location).toBe('remote');
    expect(job?.skills).toEqual(['ts', 'rn']);
    expect(rules.mapAdminJobDocument('k', { basic_info: { priceRange: { from: null, to: 5 } } })?.priceRange).toBeNull();
  });

  test('rejection reason is trimmed and empty means missing', () => {
    expect(rules.resolveRejectionReason('  ')).toBe('');
    expect(rules.resolveRejectionReason(' Spam ')).toBe('Spam');
  });

  test('describes Firestore errors instead of a generic failure', () => {
    expect(rules.describeJobActionError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' }, 'Failed to reject job'))
      .toBe('Failed to reject job: your account is not allowed to make this change.');
    expect(rules.describeJobActionError({ code: 'firestore/not-found' }, 'Failed to approve job')).toContain('no longer exists');
    expect(rules.describeJobActionError({ code: 'unavailable' }, 'X')).toContain('connection');
    expect(rules.describeJobActionError(new Error('Enter a reason for the suspension.'), 'Failed to suspend user'))
      .toBe('Failed to suspend user: Enter a reason for the suspension.');
    expect(rules.describeJobActionError(null, 'Failed to load jobs')).toBe('Failed to load jobs. Please try again.');
  });

  test('fetch limit is bounded', () => {
    expect(rules.ADMIN_JOBS_FETCH_LIMIT).toBeGreaterThan(0);
    expect(rules.ADMIN_JOBS_FETCH_LIMIT).toBeLessThanOrEqual(1000);
  });
});
