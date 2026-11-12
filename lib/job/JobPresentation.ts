import type { JobRecord } from '@/lib/job/JobsService';

/** Display helpers shared by the job cards, details sheet and job screen. */

export const getJobCompanyName = (job: JobRecord): string =>
  job.category_specific.name || job.creator?.name || 'Independent employer';

export const formatJobLocation = (job: JobRecord): string => {
  const location = job.basic_info.location;
  if (!location.type || location.type === 'remote') return 'Remote';
  return [location.city, location.country].filter(Boolean).join(', ') || location.address || (location.type === 'hybrid' ? 'Hybrid' : 'On-site');
};

export const formatJobPrice = (job: JobRecord): string => {
  const { from, to } = job.basic_info.priceRange;
  const currency = job.basic_info.currency && job.basic_info.currency !== 'USD' ? `${job.basic_info.currency} ` : '$';
  return from === to ? `${currency}${from}` : `${currency}${from} - ${currency}${to}`;
};

export const formatJobPostedDate = (job: JobRecord): string =>
  job.basic_info.createdAt ? new Date(job.basic_info.createdAt.seconds * 1000).toLocaleDateString() : 'Recently';
