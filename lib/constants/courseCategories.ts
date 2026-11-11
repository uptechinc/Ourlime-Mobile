/**
 * Course categories and subcategories, ported from the website's lib/utils/courseCategories.ts so the app's E-Learning
 * hub browses the same main categories and subcategories.
 */
export const COURSE_MAIN_CATEGORIES = [
  'Information Technology',
  'Science',
  'Business',
  'Language',
  'Art',
  'History',
  'Mathematics',
  'Engineering',
  'Health Sciences',
  'Social Sciences',
  'CXC',
] as const;

export type CourseMainCategory = (typeof COURSE_MAIN_CATEGORIES)[number];

export const COURSE_SUBCATEGORIES: Readonly<Record<CourseMainCategory, readonly string[]>> = {
  'Information Technology': ['Programming', 'Computer Science', 'Networking', 'UI/UX Design', 'Cybersecurity', 'Database Management', 'Cloud Computing', 'DevOps', 'Mobile Development', 'Web Development', 'Data Science', 'Machine Learning'],
  Science: ['Physics', 'Chemistry', 'Biology', 'Astronomy', 'Environmental Science'],
  Business: ['Marketing', 'Finance', 'Management', 'Entrepreneurship', 'Economics', 'Digital Marketing'],
  Language: ['English', 'Spanish', 'French', 'German', 'Mandarin', 'Japanese', 'Arabic'],
  Art: ['Digital Art', 'Painting', 'Photography', 'Graphic Design', 'Animation', 'Design'],
  History: ['World History', 'Ancient Civilizations', 'Modern History', 'Art History', 'Military History'],
  Mathematics: ['Algebra', 'Calculus', 'Statistics', 'Geometry', 'Number Theory'],
  Engineering: ['Mechanical', 'Electrical', 'Civil', 'Chemical', 'Software'],
  'Health Sciences': ['Anatomy', 'Physiology', 'Nutrition', 'Public Health', 'Mental Health'],
  'Social Sciences': ['Psychology', 'Sociology', 'Anthropology', 'Political Science', 'Economics'],
  CXC: ['CSEC', 'CAPE', 'Mathematics', 'English', 'Science', 'Business', 'Social Studies'],
};

/** All subcategories for a main category (empty for an unknown one). */
export const getSubcategories = (category: string): readonly string[] =>
  (COURSE_MAIN_CATEGORIES as readonly string[]).includes(category) ? COURSE_SUBCATEGORIES[category as CourseMainCategory] : [];

/** Every subcategory across all categories (e.g. instructor specialties). */
export const getAllSubcategories = (): string[] => Object.values(COURSE_SUBCATEGORIES).flat();

/** Every subcategory once, duplicates removed. */
export const getUniqueSubcategories = (): string[] => [...new Set(getAllSubcategories())];
