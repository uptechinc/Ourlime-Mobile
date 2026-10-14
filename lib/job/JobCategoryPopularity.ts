export type RankableJob = {
  category?: string | null;
  createdAtMs: number | null;
};

export type RankedJobCategory = {
  name: string;
  /** Open jobs in this category. */
  count: number;
  /** Recency-weighted demand; only used for ordering. */
  score: number;
};

const HALF_LIFE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNCATEGORIZED = 'Uncategorized';

/**
 * "Popular categories" for Jobs, the same ranking as the website (lib/job/JobCategoryPopularity.ts there).
 *
 * Each open job adds 0.5^(ageDays / 14) to its category: a job posted today counts 1, two weeks ago 0.5, a month
 * ago about 0.23. Several fresh listings outrank a single old one, and stale categories sink without disappearing.
 * Ties fall back to the plain open-job count, then the name. Application counts are not used: applications are
 * private to the applicant and the poster.
 */
export class JobCategoryPopularity {
  private static instance: JobCategoryPopularity;

  private constructor() {}

  public static getInstance(): JobCategoryPopularity {
    if (!JobCategoryPopularity.instance) JobCategoryPopularity.instance = new JobCategoryPopularity();
    return JobCategoryPopularity.instance;
  }

  public rank(jobs: RankableJob[], now: number = Date.now()): RankedJobCategory[] {
    const totals = new Map<string, RankedJobCategory>();
    for (const job of jobs) {
      const name = job.category?.trim() || UNCATEGORIZED;
      const entry = totals.get(name) ?? { name, count: 0, score: 0 };
      entry.count += 1;
      entry.score += this.recencyWeight(job.createdAtMs, now);
      totals.set(name, entry);
    }
    return [...totals.values()].sort((left, right) =>
      right.score - left.score
      || right.count - left.count
      || left.name.localeCompare(right.name));
  }

  private recencyWeight(createdAtMs: number | null, now: number): number {
    if (createdAtMs === null || !Number.isFinite(createdAtMs)) return 0.5 ** 4; // unknown age: treat as ~2 months old
    const ageDays = Math.max(0, now - createdAtMs) / DAY_MS;
    return 0.5 ** (ageDays / HALF_LIFE_DAYS);
  }
}

export const jobCategoryPopularity = JobCategoryPopularity.getInstance();
