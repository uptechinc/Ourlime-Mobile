/** Choices and policy text used by the job forms, copied from the website's createJobsModel components. */

export const JOB_CATEGORIES = ['Development', 'Design', 'Marketing', 'Business', 'Teaching', 'Plumbing', 'Banking', 'Retail', 'Food Service', 'Healthcare'] as const;
export const QUICK_TASK_CATEGORIES = [...JOB_CATEGORIES, 'Delivery', 'Cleaning', 'Moving', 'Photography', 'Other'] as const;
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'KES', 'ZAR', 'GHS', 'TTD'] as const;
export const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 'Real Estate', 'Entertainment', 'Hospitality', 'Construction', 'Transportation', 'Energy', 'Telecommunications', 'Media', 'Agriculture', 'Other'] as const;
export const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501+', label: '501+ employees' },
] as const;

export type ContactPreference = 'in_app' | 'email' | 'phone' | 'all';
export const CONTACT_OPTIONS: { value: ContactPreference; label: string; description: string }[] = [
  { value: 'in_app', label: 'In-App Only', description: 'Messages through Ourlime' },
  { value: 'email', label: 'Email', description: 'Applicants can email you' },
  { value: 'phone', label: 'Phone', description: 'Applicants can call you' },
  { value: 'all', label: 'All Methods', description: 'Any contact method' },
];

export type PaymentPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'fixed';
export const PAYMENT_PERIODS: { value: PaymentPeriod; label: string }[] = [
  { value: 'hourly', label: 'Per Hour' },
  { value: 'daily', label: 'Per Day' },
  { value: 'weekly', label: 'Per Week' },
  { value: 'monthly', label: 'Per Month' },
  { value: 'yearly', label: 'Per Year' },
  { value: 'fixed', label: 'Fixed Price' },
];

export type EducationRequirement = 'none' | 'high_school' | 'associate' | 'bachelor' | 'master' | 'doctorate' | 'certification';
export const EDUCATION_OPTIONS: { value: EducationRequirement; label: string }[] = [
  { value: 'none', label: 'No Requirement' },
  { value: 'high_school', label: 'High School' },
  { value: 'associate', label: "Associate's Degree" },
  { value: 'bachelor', label: "Bachelor's Degree" },
  { value: 'master', label: "Master's Degree" },
  { value: 'doctorate', label: 'Doctorate' },
  { value: 'certification', label: 'Professional Certification' },
];

export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'temporary';
export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'temporary', label: 'Temporary' },
];

export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'executive';
export const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'executive', label: 'Executive' },
];

export type WorkLocationType = 'onsite' | 'hybrid' | 'remote';
export const LOCATION_TYPES: { value: WorkLocationType; label: string; description: string }[] = [
  { value: 'remote', label: 'Remote', description: 'Work from anywhere' },
  { value: 'onsite', label: 'On-site', description: 'Physical location required' },
  { value: 'hybrid', label: 'Hybrid', description: 'Mix of remote and on-site' },
];

export type ScreeningAnswerType = 'input' | 'checkbox' | 'dropdown';
export const ANSWER_TYPES: { value: ScreeningAnswerType; label: string }[] = [
  { value: 'input', label: 'Text Input' },
  { value: 'checkbox', label: 'Multiple Choice' },
  { value: 'dropdown', label: 'Dropdown' },
];

export type TaskUrgency = 'low' | 'medium' | 'high' | 'critical';
export const URGENCY_OPTIONS: { value: TaskUrgency; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: 'Flexible timeline, no rush' },
  { value: 'medium', label: 'Medium', description: 'Standard priority' },
  { value: 'high', label: 'High', description: 'Needs attention soon' },
  { value: 'critical', label: 'Critical', description: 'Urgent, time-sensitive' },
];

export type TaskComplexity = 'simple' | 'moderate' | 'complex';
export const COMPLEXITY_OPTIONS: { value: TaskComplexity; label: string; description: string }[] = [
  { value: 'simple', label: 'Simple', description: 'Basic skills required' },
  { value: 'moderate', label: 'Moderate', description: 'Intermediate skills' },
  { value: 'complex', label: 'Complex', description: 'Advanced expertise needed' },
];

export type PaymentTiming = 'upfront' | 'on_completion' | 'milestone';
export const PAYMENT_TIMING_OPTIONS: { value: PaymentTiming; label: string; description: string }[] = [
  { value: 'upfront', label: 'Upfront', description: 'Paid before task begins' },
  { value: 'on_completion', label: 'On Completion', description: 'Paid when approved' },
  { value: 'milestone', label: 'Milestone', description: 'Paid at milestones' },
];
export const PAYMENT_TIMING_EXPLANATIONS: { [timing in PaymentTiming]: string } = {
  upfront: 'Your payment is held securely in escrow when the task is accepted. Funds are released to the tasker only after you approve the completed work. If the task is not completed, you can request a refund.',
  on_completion: 'Payment is charged when you accept the task. Funds are held in escrow and released to the tasker within 24 hours of your approval. You have a dispute window before funds are released.',
  milestone: 'Payment is split into milestones. Each milestone payment is released when you verify and approve that milestone. This is recommended for complex, multi-phase tasks.',
};
export const PAYMENT_TIMING_NOTES: { [timing in PaymentTiming]: string } = {
  upfront: 'Payment held in escrow until task completion',
  milestone: 'Payment released at each verified milestone',
  on_completion: 'Payment released upon task acceptance',
};

export type DurationUnit = 'hours' | 'days' | 'weeks';
export const DURATION_UNITS: { value: DurationUnit; label: string }[] = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
];

export type DeliverableUnit = 'piece' | 'file' | 'page' | 'hour' | 'day' | 'set';
export const DELIVERABLE_UNITS: { value: DeliverableUnit; label: string }[] = [
  { value: 'piece', label: 'Piece' },
  { value: 'file', label: 'File' },
  { value: 'page', label: 'Page' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'set', label: 'Set' },
];

export const CANCELLATION_TRIGGERS = [
  'Tasker cancels before starting',
  'Tasker cancels after starting',
  'Poster cancels before tasker begins',
  'Poster cancels after tasker begins',
  'Mutual agreement',
  'Dispute resolution',
] as const;

export const JOB_POSTER_DISCLAIMER = "I confirm that this is a genuine and lawful job that I am authorized to post. The description, compensation, location, requirements, deadlines, and company information are accurate and not intentionally misleading. I will not request application fees, passwords, financial credentials, verification codes, unnecessary identity documents, or unlawful payments from applicants. I will not use this listing for fraud, impersonation, prohibited discrimination, harassment, unsafe activity, recruitment into illegal activity, deceptive commission-only work, pyramid schemes, or collection of personal information unrelated to the opportunity. I understand that identity verification does not constitute Ourlime's endorsement of me, my company, or this listing. I accept responsibility for my listing, communications, hiring decisions, payment obligations, worker classification, taxes, safety requirements, and compliance with applicable laws.";
export const JOB_POSTER_AGREEMENT = 'I have read and agree to the Job Poster Disclaimer, Jobs Terms, Privacy Policy, Community Guidelines, and applicable employment and anti-discrimination requirements.';
export const TASK_POSTER_DISCLAIMER = "I confirm that this is a genuine and lawful task that I am authorized to post. The description, compensation, deliverables, deadlines, and safety requirements are accurate and not intentionally misleading. I will not request application fees, passwords, financial credentials, or unlawful payments from taskers. I understand that identity verification does not constitute Ourlime's endorsement of me or this listing. I accept responsibility for my listing, communications, payment obligations, worker classification, taxes, safety requirements, and compliance with applicable laws.";
export const TASK_POSTER_AGREEMENT = 'I have read and agree to the Task Poster Disclaimer, Jobs Terms, Privacy Policy, and Community Guidelines.';

export const JOB_SAFETY_GUIDANCE = [
  'Never pay an application, interview, training, or equipment fee.',
  'Never share banking passwords, one-time codes, or sensitive identity documents.',
  'Confirm compensation, responsibilities, and employer identity before starting work.',
  'Keep agreements and communications recorded within the platform.',
];

export const labelFor = <T extends string>(options: readonly { value: T; label: string }[], value: string | undefined): string =>
  options.find((option) => option.value === value)?.label ?? value ?? '';

export const APPLICANT_DISCLAIMER_VERSION = '1.0';
export const APPLICANT_DISCLAIMER = 'I understand that submitting an application does not guarantee employment, payment, an interview, or selection. I confirm that the information I provide is accurate and that I am authorized to submit all uploaded documents. I understand that Ourlime provides tools for connecting users but does not automatically verify every claim made in a job listing or guarantee the conduct of a job poster. I will independently review the opportunity, compensation, working conditions, and the identity or authority of the person offering the job. I will not send money, passwords, financial credentials, verification codes, or unnecessary sensitive information to a job poster. I agree to report suspicious, misleading, discriminatory, illegal, or unsafe listings.';
export const APPLICANT_SAFETY_GUIDANCE = [
  'Never pay an application, interview, training, equipment, or processing fee unless independently verified.',
  'Never provide passwords, banking credentials, one-time codes, or full identification documents through chat.',
  'Confirm compensation, responsibilities, work location, and employer identity before accepting work.',
  'Keep important agreements in writing.',
  'Report requests to move immediately to an unverified platform.',
  'Report listings that request illegal, unsafe, discriminatory, or misleading activity.',
  'For urgent danger, contact your local emergency or law-enforcement service immediately.',
];
export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'];
