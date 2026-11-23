import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

// Trinidad and Tobago (UTC-4): most members are there.
const originalTimeZone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/Port_of_Spain'; });
afterAll(() => { process.env.TZ = originalTimeZone; });

const { canApplicantWithdraw, canEmployerChangeApplicationStatus, endOfLocalDay } = await import('../job/JobRules.ts');
const { jobListFilterService } = await import('../job/JobListFilterService.ts');

const EMPTY_FILTERS = { employmentType: '', experienceLevel: '', locationType: '', category: '', salaryMin: '', salaryMax: '', postingDate: '', closingDate: '' };

const job = (id, overrides = {}) => ({
  id,
  basic_info: {
    type: 'professional', title: `Job ${id}`, description: '', userId: 'poster', status: 'published', category: 'Technology',
    location: { type: 'remote' }, priceRange: { from: 100, to: 200 }, createdAt: { seconds: 1000 },
    ...overrides.basic_info,
  },
  details: { skills: [], ...overrides.details },
  category_specific: { ...overrides.category_specific },
});

const listQuery = (overrides = {}) => ({ category: '', search: '', location: '', filters: EMPTY_FILTERS, sort: 'relevance', ...overrides });
const ids = (jobs) => jobs.map((entry) => entry.id);

describe('application status rules', () => {
  test('employers move applications forward, including to Offer', () => {
    expect(canEmployerChangeApplicationStatus('pending', 'reviewing')).toBe(true);
    expect(canEmployerChangeApplicationStatus('reviewing', 'offer')).toBe(true);
    expect(canEmployerChangeApplicationStatus('interviewing', 'offer')).toBe(true);
    expect(canEmployerChangeApplicationStatus('offer', 'accepted')).toBe(true);
    expect(canEmployerChangeApplicationStatus('pending', 'accepted')).toBe(false);
  });

  test('withdrawn and final applications stay as they are; the employer never withdraws', () => {
    for (const status of ['accepted', 'rejected', 'withdrawn', 'job_withdrawn']) {
      for (const next of ['pending', 'reviewing', 'interviewing', 'offer', 'accepted', 'rejected']) {
        expect(canEmployerChangeApplicationStatus(status, next)).toBe(false);
      }
    }
    expect(canEmployerChangeApplicationStatus('pending', 'withdrawn')).toBe(false);
    expect(canEmployerChangeApplicationStatus('reviewing', 'withdrawn')).toBe(false);
  });

  test('unknown or malformed statuses never transition', () => {
    expect(canEmployerChangeApplicationStatus('', 'reviewing')).toBe(false);
    expect(canEmployerChangeApplicationStatus(undefined, 'reviewing')).toBe(false);
    expect(canEmployerChangeApplicationStatus('toString', 'reviewing')).toBe(false);
    expect(canEmployerChangeApplicationStatus('pending', null)).toBe(false);
  });

  test('applicants withdraw only pending or reviewing applications', () => {
    expect(canApplicantWithdraw('pending')).toBe(true);
    expect(canApplicantWithdraw('reviewing')).toBe(true);
    expect(canApplicantWithdraw('interviewing')).toBe(false);
    expect(canApplicantWithdraw('withdrawn')).toBe(false);
    expect(canApplicantWithdraw('')).toBe(false);
  });
});

describe('closing dates', () => {
  test('a picked day closes at the end of that local day, whatever time it was picked at', () => {
    const pickedAtThreePm = new Date(2026, 10, 23, 15, 17, 42);
    const closing = endOfLocalDay(pickedAtThreePm);
    expect([closing.getFullYear(), closing.getMonth(), closing.getDate(), closing.getHours(), closing.getMinutes(), closing.getSeconds()])
      .toEqual([2026, 10, 23, 23, 59, 59]);
    expect(closing.toISOString()).toBe('2026-11-24T03:59:59.000Z');
  });

  test('closing today is still in the future, so today can be picked', () => {
    const now = new Date(2026, 10, 23, 21, 0, 0);
    expect(endOfLocalDay(now) > now).toBe(true);
  });

  test('month and year ends do not roll over', () => {
    expect(endOfLocalDay(new Date(2026, 11, 31, 0, 0, 0)).getDate()).toBe(31);
    expect(endOfLocalDay(new Date(2028, 1, 29, 8)).getMonth()).toBe(1);
  });
});

describe('Jobs list filters and sort', () => {
  test('hides unpublished listings', () => {
    const jobs = [job('open'), ...['draft', 'pending_review', 'rejected', 'paused', 'closed', 'expired', 'archived', 'deleted'].map((status) => job(status, { basic_info: { status } }))];
    expect(ids(jobListFilterService.apply(jobs, listQuery()))).toEqual(['open']);
  });

  test('search matches title, skills and company, ignoring case and surrounding spaces', () => {
    const jobs = [
      job('a', { basic_info: { title: 'Senior React Developer' } }),
      job('b', { details: { skills: ['TypeScript'] } }),
      job('c', { category_specific: { name: 'Ourlime Ltd' } }),
      job('d', { basic_info: { title: 'Café barista ☕' } }),
    ];
    expect(ids(jobListFilterService.apply(jobs, listQuery({ search: '  react ' })))).toEqual(['a']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ search: 'typescript' })))).toEqual(['b']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ search: 'OURLIME' })))).toEqual(['c']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ search: 'café' })))).toEqual(['d']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ search: '   ' })))).toEqual(['a', 'b', 'c', 'd']);
  });

  test('pay filters compare against the right end of the range and ignore junk', () => {
    const jobs = [job('low', { basic_info: { priceRange: { from: 10, to: 50 } } }), job('high', { basic_info: { priceRange: { from: 500, to: 900 } } })];
    expect(ids(jobListFilterService.apply(jobs, listQuery({ filters: { ...EMPTY_FILTERS, salaryMin: '100' } })))).toEqual(['high']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ filters: { ...EMPTY_FILTERS, salaryMax: '100' } })))).toEqual(['low']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ filters: { ...EMPTY_FILTERS, salaryMin: 'abc' } })))).toEqual(['low', 'high']);
  });

  test('employment type and location type compare loosely', () => {
    const jobs = [job('ft', { basic_info: { employmentType: 'full-time', location: { type: 'onsite' } } }), job('pt', { basic_info: { employmentType: 'part-time' } })];
    expect(ids(jobListFilterService.apply(jobs, listQuery({ filters: { ...EMPTY_FILTERS, employmentType: 'Full-time' } })))).toEqual(['ft']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ filters: { ...EMPTY_FILTERS, locationType: 'On-site' } })))).toEqual(['ft']);
  });

  test('date filters use whole local days', () => {
    const closesNov30Evening = endOfLocalDay(new Date(2026, 10, 30)).getTime() / 1000;
    const postedNov19Evening = new Date(2026, 10, 19, 21).getTime() / 1000;
    const jobs = [job('a', { basic_info: { closingDate: { seconds: closesNov30Evening }, createdAt: { seconds: postedNov19Evening } } })];
    expect(ids(jobListFilterService.apply(jobs, listQuery({ filters: { ...EMPTY_FILTERS, closingDate: '2026-11-30' } })))).toEqual(['a']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ filters: { ...EMPTY_FILTERS, closingDate: '2026-11-29' } })))).toEqual([]);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ filters: { ...EMPTY_FILTERS, postingDate: '2026-11-19' } })))).toEqual(['a']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ filters: { ...EMPTY_FILTERS, postingDate: '2026-11-20' } })))).toEqual([]);
  });

  test('sorts by pay, deadline (no deadline last) and newest without mutating the input', () => {
    const jobs = [
      job('a', { basic_info: { priceRange: { from: 1, to: 100 }, createdAt: { seconds: 3 } } }),
      job('b', { basic_info: { priceRange: { from: 90, to: 95 }, closingDate: { seconds: 50 }, createdAt: { seconds: 1 } } }),
      job('c', { basic_info: { priceRange: { from: 5, to: 500 }, closingDate: { seconds: 10 }, createdAt: { seconds: 2 } } }),
    ];
    const original = ids(jobs);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ sort: 'compensation' })))).toEqual(['c', 'a', 'b']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ sort: 'deadline' })))).toEqual(['c', 'b', 'a']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ sort: 'newest' })))).toEqual(['a', 'c', 'b']);
    expect(ids(jobListFilterService.apply(jobs, listQuery({ sort: 'relevance' })))).toEqual(original);
    expect(ids(jobs)).toEqual(original);
  });

  test('category filter falls back to Uncategorized', () => {
    const jobs = [job('none', { basic_info: { category: '' } }), job('tech')];
    expect(ids(jobListFilterService.apply(jobs, listQuery({ category: 'Uncategorized' })))).toEqual(['none']);
    expect(jobListFilterService.hasNarrowing(listQuery())).toBe(false);
    expect(jobListFilterService.hasNarrowing(listQuery({ search: '  ' }))).toBe(false);
    expect(jobListFilterService.hasNarrowing(listQuery({ filters: { ...EMPTY_FILTERS, salaryMin: '1' } }))).toBe(true);
  });
});
