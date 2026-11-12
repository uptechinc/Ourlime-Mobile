import type { JobRecord } from '@/lib/job/JobsService';
import type { JobFiltersState, JobSortOption } from '@/components/jobs/JobFiltersSheet';

export type JobListQuery = {
  category: string;
  search: string;
  location: string;
  filters: JobFiltersState;
  sort: JobSortOption;
};

const HIDDEN_STATUSES = new Set(['draft', 'pending_review', 'rejected', 'paused', 'closed', 'expired', 'archived', 'deleted']);
/** 'Full-time' / 'full-time', 'On-site' / 'onsite' compare equal. */
const normalize = (value: string | undefined): string => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Search, filters and sort of the Jobs list, the same rules as the website's /jobs page. */
export class JobListFilterService {
  private static instance: JobListFilterService;

  private constructor() {}

  public static getInstance(): JobListFilterService {
    if (!JobListFilterService.instance) JobListFilterService.instance = new JobListFilterService();
    return JobListFilterService.instance;
  }

  public hasNarrowing(listQuery: Omit<JobListQuery, 'sort'>): boolean {
    return Boolean(listQuery.category || listQuery.search.trim() || listQuery.location.trim() || Object.values(listQuery.filters).some(Boolean));
  }

  public apply(jobs: JobRecord[], listQuery: JobListQuery): JobRecord[] {
    const { filters } = listQuery;
    let filtered = jobs.filter((job) => {
      const info = job.basic_info;
      if (HIDDEN_STATUSES.has(info.status ?? '')) return false;
      const category = info.category || job.category || 'Uncategorized';
      if (listQuery.category && category !== listQuery.category) return false;
      if (filters.employmentType && normalize(info.employmentType) !== normalize(filters.employmentType)) return false;
      if (filters.experienceLevel && normalize(info.experienceLevel) !== normalize(filters.experienceLevel)) return false;
      if (filters.locationType && normalize(info.location.type) !== normalize(filters.locationType)) return false;
      if (filters.category && category.toLowerCase() !== filters.category.trim().toLowerCase()) return false;
      if (filters.salaryMin && info.priceRange.to < Number(filters.salaryMin)) return false;
      if (filters.salaryMax && info.priceRange.from > Number(filters.salaryMax)) return false;
      if (filters.postingDate && info.createdAt && new Date(info.createdAt.seconds * 1000) < new Date(`${filters.postingDate}T00:00:00`)) return false;
      if (filters.closingDate && info.closingDate && new Date(info.closingDate.seconds * 1000) > new Date(`${filters.closingDate}T23:59:59`)) return false;
      return true;
    });

    const location = listQuery.location.trim().toLowerCase();
    if (location) {
      filtered = filtered.filter((job) => [job.basic_info.location.type, job.basic_info.location.address, job.basic_info.location.city, job.basic_info.location.country]
        .some((field) => typeof field === 'string' && field.toLowerCase().includes(location)));
    }

    const search = listQuery.search.trim().toLowerCase();
    if (search) {
      filtered = filtered.filter((job) => [
        job.basic_info.title, job.basic_info.description, job.basic_info.category, job.basic_info.location.type, job.basic_info.location.city,
        job.basic_info.location.country, job.category_specific.name, job.category_specific.type, job.category_specific.duration, ...job.details.skills,
      ].some((field) => typeof field === 'string' && field.toLowerCase().includes(search)));
    }

    const sorted = [...filtered];
    if (listQuery.sort === 'newest') sorted.sort((left, right) => (right.basic_info.createdAt?.seconds ?? 0) - (left.basic_info.createdAt?.seconds ?? 0));
    if (listQuery.sort === 'compensation') sorted.sort((left, right) => right.basic_info.priceRange.to - left.basic_info.priceRange.to);
    if (listQuery.sort === 'deadline') sorted.sort((left, right) => (left.basic_info.closingDate?.seconds ?? Number.MAX_SAFE_INTEGER) - (right.basic_info.closingDate?.seconds ?? Number.MAX_SAFE_INTEGER));
    return sorted;
  }
}

export const jobListFilterService = JobListFilterService.getInstance();
