import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { privateProfileService } from '@/lib/services/PrivateProfileService';

/** Same ten platforms, keys and profile URLs as the website's SocialLinksDisplay. */
export type SocialLinkKey = 'x' | 'facebook' | 'instagram' | 'tiktok' | 'linkedIn' | 'youtube' | 'github' | 'discord' | 'snapchat' | 'pinterest';
export type SocialLinks = Partial<Record<SocialLinkKey, string>>;
export type SocialPlatform = { key: SocialLinkKey; name: string; profileBaseUrl: string };
export type SocialLinkItem = SocialPlatform & { value: string; url: string };

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'x', name: 'X', profileBaseUrl: 'https://x.com/' },
  { key: 'facebook', name: 'Facebook', profileBaseUrl: 'https://facebook.com/' },
  { key: 'instagram', name: 'Instagram', profileBaseUrl: 'https://instagram.com/' },
  { key: 'tiktok', name: 'TikTok', profileBaseUrl: 'https://tiktok.com/@' },
  { key: 'linkedIn', name: 'LinkedIn', profileBaseUrl: 'https://linkedin.com/in/' },
  { key: 'youtube', name: 'YouTube', profileBaseUrl: 'https://youtube.com/@' },
  { key: 'github', name: 'GitHub', profileBaseUrl: 'https://github.com/' },
  { key: 'discord', name: 'Discord', profileBaseUrl: 'https://discord.com/users/' },
  { key: 'snapchat', name: 'Snapchat', profileBaseUrl: 'https://snapchat.com/add/' },
  { key: 'pinterest', name: 'Pinterest', profileBaseUrl: 'https://pinterest.com/' },
];

export type WorkExperienceEntry = { id: string; role: string; company: string; startDate: string; endDate: string | null; current: boolean; description: string };
export type EducationEntry = { id: string; degree: string; school: string; startDate: string; endDate: string | null; current: boolean; description: string };
export type WorkExperienceInput = Omit<WorkExperienceEntry, 'id'>;
export type EducationInput = Omit<EducationEntry, 'id'>;
export type AboutValueKind = 'interests' | 'skills';
export type AboutValueEntry = { id: string; value: string };
export type ContactType = 'personal' | 'work' | 'business' | 'emergency';
export type ContactEntry = { number: string; type: ContactType | string; isVerified: boolean };

export type ProfileAboutData = {
  workExperience: WorkExperienceEntry[];
  education: EducationEntry[];
  interests: AboutValueEntry[];
  skills: AboutValueEntry[];
  socialLinks: SocialLinks;
  /** Own profile only (users/{uid}/private/profile.contacts). */
  contacts: ContactEntry[];
  gender: string;
  country: string;
  joinedAtMs: number | null;
};

export const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: 'personal', label: 'Personal' },
  { value: 'work', label: 'Work' },
  { value: 'business', label: 'Business' },
  { value: 'emergency', label: 'Emergency' },
];

/** Website ContactSection limits. */
export const MAX_CONTACTS = 20;
const PHONE_PATTERN = /^\+[1-9]\d{1,14}$/;
const MAX_ABOUT_VALUE_LENGTH = 500;

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Dates are stored as ISO strings by the website (JSON-serialised Date); older rows may be Timestamps. */
const readDate = (value: unknown): string | null => {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
};

const readMillis = (value: unknown): number | null => {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * Profile "About" details shared with the website: work experience, education, interests and skills
 * (users/{uid}/workExperience, /education, /about), social links (users/{uid}.socialLinks) and the member's
 * own contact numbers (users/{uid}/private/profile.contacts).
 */
export class ProfileAboutService {
  private static instance: ProfileAboutService;

  private constructor() {}

  public static getInstance(): ProfileAboutService {
    if (!ProfileAboutService.instance) ProfileAboutService.instance = new ProfileAboutService();
    return ProfileAboutService.instance;
  }

  public toSocialLinkItems(socialLinks: SocialLinks): SocialLinkItem[] {
    return SOCIAL_PLATFORMS.flatMap((platform) => {
      const value = socialLinks[platform.key]?.trim();
      if (!value) return [];
      const url = this.toExternalUrl(value, platform.profileBaseUrl);
      return url ? [{ ...platform, value, url }] : [];
    });
  }

  public readSocialLinks(value: unknown): SocialLinks {
    if (!value || typeof value !== 'object') return {};
    const source = value as Partial<Record<SocialLinkKey, unknown>>;
    return SOCIAL_PLATFORMS.reduce<SocialLinks>((links, platform) => {
      const linkValue = source[platform.key];
      if (typeof linkValue === 'string' && linkValue.trim()) links[platform.key] = linkValue.trim();
      return links;
    }, {});
  }

  /** Header extras the shared UserProfile type does not carry: social links, country and join date. */
  public async loadHeaderDetails(userId: string): Promise<{ socialLinks: SocialLinks; country: string; joinedAtMs: number | null }> {
    const snapshot = await getDoc(doc(db, 'users', userId));
    const user: DocumentData = snapshot.data() ?? {};
    return { socialLinks: this.readSocialLinks(user.socialLinks), country: readString(user.country), joinedAtMs: readMillis(user.createdAt) };
  }

  public async load(userId: string, isOwnProfile: boolean): Promise<ProfileAboutData> {
    const [userSnapshot, workSnapshot, educationSnapshot, interestsSnapshot, skillsSnapshot] = await Promise.all([
      getDoc(doc(db, 'users', userId)),
      getDocs(query(collection(db, 'users', userId, 'workExperience'), orderBy('startDate', 'desc'))).catch(() => getDocs(collection(db, 'users', userId, 'workExperience'))),
      getDocs(query(collection(db, 'users', userId, 'education'), orderBy('startDate', 'desc'))).catch(() => getDocs(collection(db, 'users', userId, 'education'))),
      getDocs(query(collection(db, 'users', userId, 'about'), where('type', '==', 'interests'))),
      getDocs(query(collection(db, 'users', userId, 'about'), where('type', '==', 'skills'))),
    ]);
    const user: DocumentData = userSnapshot.data() ?? {};
    const contacts = isOwnProfile ? await this.loadOwnContacts(userId, user) : [];
    return {
      workExperience: workSnapshot.docs.map((entry) => this.toWork(entry.id, entry.data())),
      education: educationSnapshot.docs.map((entry) => this.toEducation(entry.id, entry.data())),
      interests: interestsSnapshot.docs.map((entry) => ({ id: entry.id, value: readString(entry.data().value) })).filter((entry) => entry.value),
      skills: skillsSnapshot.docs.map((entry) => ({ id: entry.id, value: readString(entry.data().value) })).filter((entry) => entry.value),
      socialLinks: this.readSocialLinks(user.socialLinks),
      contacts,
      gender: readString(user.gender),
      country: readString(user.country),
      joinedAtMs: readMillis(user.createdAt),
    };
  }

  // ── Work experience (website WorkExperienceSection) ──

  public async addWorkExperience(userId: string, input: WorkExperienceInput): Promise<WorkExperienceEntry> {
    const payload = this.validateWork(input);
    const reference = await addDoc(collection(db, 'users', userId, 'workExperience'), { ...payload, createdAt: new Date() });
    return { id: reference.id, ...payload };
  }

  public async updateWorkExperience(userId: string, entryId: string, input: WorkExperienceInput): Promise<WorkExperienceEntry> {
    const payload = this.validateWork(input);
    await updateDoc(doc(db, 'users', userId, 'workExperience', entryId), { ...payload, updatedAt: new Date() });
    return { id: entryId, ...payload };
  }

  public async deleteWorkExperience(userId: string, entryId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId, 'workExperience', entryId));
  }

  // ── Education (website EducationSection) ──

  public async addEducation(userId: string, input: EducationInput): Promise<EducationEntry> {
    const payload = this.validateEducation(input);
    const reference = await addDoc(collection(db, 'users', userId, 'education'), { ...payload, createdAt: new Date() });
    return { id: reference.id, ...payload };
  }

  public async updateEducation(userId: string, entryId: string, input: EducationInput): Promise<EducationEntry> {
    const payload = this.validateEducation(input);
    await updateDoc(doc(db, 'users', userId, 'education', entryId), { ...payload, updatedAt: new Date() });
    return { id: entryId, ...payload };
  }

  public async deleteEducation(userId: string, entryId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId, 'education', entryId));
  }

  // ── Interests and skills (website InterestsSkillsSection, users/{uid}/about) ──

  public async addAboutValue(userId: string, kind: AboutValueKind, value: string): Promise<AboutValueEntry> {
    const trimmed = this.validateAboutValue(value);
    const reference = await addDoc(collection(db, 'users', userId, 'about'), { type: kind, value: trimmed, createdAt: new Date() });
    return { id: reference.id, value: trimmed };
  }

  public async updateAboutValue(userId: string, kind: AboutValueKind, entryId: string, value: string): Promise<AboutValueEntry> {
    const trimmed = this.validateAboutValue(value);
    await updateDoc(doc(db, 'users', userId, 'about', entryId), { type: kind, value: trimmed, updatedAt: new Date() });
    return { id: entryId, value: trimmed };
  }

  public async deleteAboutValue(userId: string, entryId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId, 'about', entryId));
  }

  // ── Contact numbers (website ContactSection, users/{uid}/private/profile.contacts) ──

  public async addContact(userId: string, number: string, type: ContactType): Promise<ContactEntry[]> {
    const normalized = number.replace(/[\s()-]/g, '');
    if (!PHONE_PATTERN.test(normalized)) throw new Error('Invalid phone number format. Use the international format, e.g. +18685551234.');
    const current = await this.loadOwnContacts(userId);
    if (current.some((contact) => contact.number === normalized)) throw new Error('This number is already added');
    if (current.length >= MAX_CONTACTS) throw new Error(`You can save up to ${MAX_CONTACTS} contact numbers.`);
    const next = [...current, { number: normalized, type, isVerified: false }];
    await this.saveContacts(userId, next);
    return next;
  }

  public async removeContact(userId: string, number: string): Promise<ContactEntry[]> {
    const current = await this.loadOwnContacts(userId);
    const next = current.filter((contact) => contact.number !== number);
    await this.saveContacts(userId, next);
    return next;
  }

  private async saveContacts(userId: string, contacts: ContactEntry[]): Promise<void> {
    await setDoc(privateProfileService.reference(userId), { contacts, updatedAt: serverTimestamp() }, { merge: true });
  }

  private async loadOwnContacts(userId: string, legacyUser?: DocumentData): Promise<ContactEntry[]> {
    const privateSnapshot = await getDoc(privateProfileService.reference(userId)).catch(() => null);
    const privateContacts: unknown = privateSnapshot?.data()?.contacts;
    const source: unknown = Array.isArray(privateContacts) ? privateContacts : legacyUser?.contacts;
    if (!Array.isArray(source)) return [];
    return source.flatMap((item: unknown): ContactEntry[] => {
      if (!item || typeof item !== 'object') return [];
      const record = item as { number?: unknown; type?: unknown; isVerified?: unknown };
      const number = readString(record.number);
      return number ? [{ number, type: readString(record.type) || 'personal', isVerified: record.isVerified === true }] : [];
    });
  }

  private toWork(id: string, data: DocumentData): WorkExperienceEntry {
    return {
      id,
      role: readString(data.role),
      company: readString(data.company),
      startDate: readDate(data.startDate) ?? '',
      endDate: readDate(data.endDate),
      current: data.current === true,
      description: readString(data.description),
    };
  }

  private toEducation(id: string, data: DocumentData): EducationEntry {
    return {
      id,
      degree: readString(data.degree),
      school: readString(data.school),
      startDate: readDate(data.startDate) ?? '',
      endDate: readDate(data.endDate),
      current: data.current === true,
      description: readString(data.description),
    };
  }

  private validateWork(input: WorkExperienceInput): WorkExperienceInput {
    const role = input.role.trim();
    const company = input.company.trim();
    if (!role || !company) throw new Error('Job title and company are required.');
    if (!input.startDate) throw new Error('Start date is required.');
    return { role, company, startDate: input.startDate, endDate: input.current ? null : input.endDate, current: input.current, description: input.description.trim() };
  }

  private validateEducation(input: EducationInput): EducationInput {
    const degree = input.degree.trim();
    const school = input.school.trim();
    if (!degree || !school) throw new Error('Degree and school are required.');
    if (!input.startDate) throw new Error('Start date is required.');
    return { degree, school, startDate: input.startDate, endDate: input.current ? null : input.endDate, current: input.current, description: input.description.trim() };
  }

  private validateAboutValue(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw new Error('Enter a value first.');
    if (trimmed.length > MAX_ABOUT_VALUE_LENGTH) throw new Error(`Keep it under ${MAX_ABOUT_VALUE_LENGTH} characters.`);
    return trimmed;
  }

  private toExternalUrl(value: string, profileBaseUrl: string): string | null {
    if (/^https?:\/\//i.test(value)) return value;
    const handle = value.replace(/^@/, '');
    return handle ? `${profileBaseUrl}${encodeURIComponent(handle)}` : null;
  }
}

export const profileAboutService = ProfileAboutService.getInstance();
