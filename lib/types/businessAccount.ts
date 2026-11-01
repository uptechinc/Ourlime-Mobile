// Mirrors what the website's /api/business-account GET returns (BusinessAccountService.getBusinessAccount),
// through the app's ehubApi function.
export type BusinessContact = { email: string; phone: string; website: string };

export type BusinessAccountProfile = {
  name: string;
  established: string;
  description: string;
  location: string;
  contact: BusinessContact;
};

export type BusinessAccount = {
  profile: BusinessAccountProfile;
  metrics: { totalProducts: number; totalSales: number; avgRating: number; responseRate: string };
  rating: { delivery: number; overall: number; product: number; service: number };
  reviews: { negative: number; positive: number; total: number };
  categories: string[];
};

/** The fields the business account screen edits; sent as the website's PUT { updates } shape. */
export type BusinessAccountForm = BusinessAccountProfile & { categories: string[] };
