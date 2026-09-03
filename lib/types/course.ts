export type CourseInstructor = {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  bio?: string;
  role?: string;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  instructor: CourseInstructor;
  category: string;
  subcategory?: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in hours
  price: number; // 0 for free
  image: string;
  thumbnail?: string;
  rating: number;
  totalRatings: number;
  enrolledStudents: number;
  status: 'draft' | 'published' | 'archived';
  isPublic: boolean;
  tags: string[];
  prerequisites?: string[];
  learningObjectives?: string[];
  featured?: boolean;
  difficulty?: number; // 1-5 scale
  language?: string;
  createdAt?: { seconds?: number; toDate?: () => Date } | string | Date;
  updatedAt?: { seconds?: number; toDate?: () => Date } | string | Date;
};

export type CourseLesson = {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description?: string;
  type: 'video' | 'text' | 'quiz' | 'assignment' | 'resource';
  content?: string; // video URL or markdown text
  duration?: number; // in minutes
  order: number;
  isRequired?: boolean;
  isPublished?: boolean;
  isFree?: boolean;
};

export type CourseResource = {
  id: string;
  moduleId: string;
  title: string;
  type: 'file' | 'link' | 'video' | 'document';
  url: string;
  size?: number;
  format?: string;
  description?: string;
  order: number;
  isRequired?: boolean;
};

export type CourseModule = {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  isPublished?: boolean;
  lessons?: CourseLesson[];
  resources?: CourseResource[];
};

export type Enrollment = {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: { seconds?: number; toDate?: () => Date } | string | Date;
  status: 'active' | 'completed' | 'dropped' | 'suspended';
  progress: number; // 0-100
  lastAccessed?: { seconds?: number; toDate?: () => Date } | string | Date;
  completedLessons?: string[];
  certificateIssued?: boolean;
  certificateUrl?: string;
  course?: Course;
};

export type CourseReview = {
  id: string;
  userId: string;
  courseId: string;
  userName: string;
  userAvatar?: string;
  rating: number; // 1-5
  comment: string;
  createdAt: { seconds?: number; toDate?: () => Date } | string | Date;
};

export type CxcSubject = {
  id: string;
  code: string;
  title: string;
  level: 'CSEC' | 'CAPE';
  category: string;
  iconName?: string;
  topicsCount: number;
  pastPapersCount: number;
  papers: Array<{
    year: number;
    paperNumber: number;
    title: string;
    url?: string;
  }>;
};
