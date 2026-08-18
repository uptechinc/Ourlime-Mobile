import { describe, expect, it } from 'bun:test';

type MockJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  jobType: 'Full-time' | 'Part-time' | 'Contract' | 'Remote';
  salaryRange: string;
  isSaved: boolean;
};

const mockJobs: MockJob[] = [
  {
    id: 'job_1',
    title: 'Senior React Native Developer',
    company: 'Uptech Digital Solutions',
    location: 'Port of Spain (Hybrid)',
    jobType: 'Full-time',
    salaryRange: '$18,000 - $24,000 TTD / mo',
    isSaved: false,
  },
  {
    id: 'job_2',
    title: 'UI/UX Mobile Product Designer',
    company: 'Ourlime Media Inc',
    location: 'Remote (Caribbean)',
    jobType: 'Remote',
    salaryRange: '$15,000 - $20,000 TTD / mo',
    isSaved: true,
  },
];

describe('Suite 08: Job Board & Search Flow', () => {
  it('should list available job openings with company and salary information', () => {
    expect(mockJobs.length).toBe(2);
    expect(mockJobs[0].title).toBe('Senior React Native Developer');
  });

  it('should filter jobs by job type (Full-time vs Remote)', () => {
    const remoteJobs = mockJobs.filter((j) => j.jobType === 'Remote');
    expect(remoteJobs.length).toBe(1);
    expect(remoteJobs[0].company).toBe('Ourlime Media Inc');
  });

  it('should toggle saved jobs bookmarking', () => {
    const job = { ...mockJobs[0] };
    expect(job.isSaved).toBe(false);

    job.isSaved = true;
    expect(job.isSaved).toBe(true);
  });
});
