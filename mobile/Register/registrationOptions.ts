import {
  Book, BookOpen, Briefcase, Car, ChefHat, Church, Dog, Dumbbell, Film, Gamepad, Globe, GraduationCap, Heart,
  Laptop, Music, Newspaper, Plane, ShoppingCart, Sword, TestTube, Trees, Tv, type LucideIcon,
} from 'lucide-react-native';

export type RegistrationInterest = { name: string; icon: LucideIcon; category: string };

/** The website's sign-up interests (components/register/InterestsStep.tsx): same names, saved to selectedInterests. */
export const REGISTRATION_INTERESTS: readonly RegistrationInterest[] = [
  { name: 'Vehicles', icon: Car, category: 'Lifestyle' },
  { name: 'Fashion', icon: ShoppingCart, category: 'Lifestyle' },
  { name: 'Technology', icon: Laptop, category: 'Tech' },
  { name: 'Videogames', icon: Gamepad, category: 'Entertainment' },
  { name: 'Sports', icon: Dumbbell, category: 'Fitness' },
  { name: 'Nature', icon: Trees, category: 'Outdoors' },
  { name: 'News', icon: Newspaper, category: 'Media' },
  { name: 'Music', icon: Music, category: 'Entertainment' },
  { name: 'Cooking', icon: ChefHat, category: 'Lifestyle' },
  { name: 'Business', icon: Briefcase, category: 'Professional' },
  { name: 'Religious', icon: Church, category: 'Spiritual' },
  { name: 'Fitness', icon: Dumbbell, category: 'Health' },
  { name: 'Movies', icon: Film, category: 'Entertainment' },
  { name: 'Anime', icon: Film, category: 'Entertainment' },
  { name: 'Science', icon: TestTube, category: 'Academic' },
  { name: 'Animals', icon: Dog, category: 'Lifestyle' },
  { name: 'Politics', icon: Globe, category: 'Current Affairs' },
  { name: 'History', icon: BookOpen, category: 'Academic' },
  { name: 'Travel', icon: Plane, category: 'Lifestyle' },
  { name: 'Reading', icon: Book, category: 'Hobbies' },
  { name: 'Health', icon: Heart, category: 'Wellness' },
  { name: 'Education', icon: GraduationCap, category: 'Academic' },
  { name: 'Martial Arts', icon: Sword, category: 'Fitness' },
  { name: 'TV Shows', icon: Tv, category: 'Entertainment' },
];

/** The website requires at least two interests before the profile preview. */
export const MINIMUM_INTERESTS = 2;

/** The website's student levels (components/register/DemographicsStep.tsx), stored as studentLevel. */
export const STUDENT_LEVELS: readonly string[] = [
  'Primary School',
  'Secondary School Form 1',
  'Secondary School Form 2',
  'Secondary School Form 3',
  'Secondary School Form 4',
  'Secondary School Form 5',
  'Other Student',
];

/** The website's gender options: the value is what is saved, the label what is shown. */
export const GENDERS: readonly { value: string; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
