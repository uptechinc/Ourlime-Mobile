import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

export type PromotedContentCategory = 'Job' | 'Community';

export type PromotedContentItem = {
  id: string;
  title: string;
  description: string;
  category: PromotedContentCategory;
  metric: string;
  image: string;
};

const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};

/**
 * Website "Promoted" card (right column): active jobs interleaved with the most-joined communities.
 * Same sources as the website's promotedContentServer, read straight from Firestore.
 */
export class PromotedContentService {
  private static instance: PromotedContentService;

  private constructor() {}

  public static getInstance(): PromotedContentService {
    if (!PromotedContentService.instance) PromotedContentService.instance = new PromotedContentService();
    return PromotedContentService.instance;
  }

  public async getPromotedContent(requestedLimit = 6): Promise<PromotedContentItem[]> {
    const maxItems = Math.min(Math.max(Math.trunc(requestedLimit), 1), 6);
    const sourceLimit = Math.max(maxItems, 6);
    const [jobs, communities] = await Promise.all([
      this.loadJobs(sourceLimit).catch((error: unknown) => {
        console.warn('[PromotedContentService.loadJobs] Error:', error instanceof Error ? error.message : 'jobs unavailable');
        return [] as PromotedContentItem[];
      }),
      this.loadCommunities(sourceLimit).catch((error: unknown) => {
        console.warn('[PromotedContentService.loadCommunities] Error:', error instanceof Error ? error.message : 'communities unavailable');
        return [] as PromotedContentItem[];
      }),
    ]);

    const promotedItems: PromotedContentItem[] = [];
    for (let index = 0; promotedItems.length < maxItems; index += 1) {
      const job = jobs[index];
      const community = communities[index];
      if (!job && !community) break;
      if (job) promotedItems.push(job);
      if (community && promotedItems.length < maxItems) promotedItems.push(community);
    }
    return promotedItems;
  }

  private async loadJobs(sourceLimit: number): Promise<PromotedContentItem[]> {
    const snapshot = await getDocs(query(collection(db, 'jobs'), where('basic_info.status', '==', 'active'), limit(sourceLimit)));
    const entries = snapshot.docs.map((jobDocument) => ({ id: jobDocument.id, info: readRecord(jobDocument.data().basic_info) }));
    const creatorIds = [...new Set(entries.map((entry) => readText(entry.info.userId)).filter(Boolean))];
    const creatorImages = new Map<string, string>();
    await Promise.all(creatorIds.map(async (creatorId) => {
      try {
        const creator = await getDoc(doc(db, 'users', creatorId));
        const data = creator.data() ?? {};
        creatorImages.set(creatorId, readText(data.profileImage) || readText(data.profilePicture));
      } catch {
        creatorImages.set(creatorId, '');
      }
    }));
    return entries.map(({ id, info }) => {
      const jobType = readText(info.type) || 'Job';
      const city = readText(readRecord(info.location).city) || 'Remote';
      return {
        id,
        title: readText(info.title) || 'Job Opportunity',
        description: `${jobType} • ${city}`,
        category: 'Job' as const,
        metric: 'Apply Now',
        image: creatorImages.get(readText(info.userId)) ?? '',
      };
    });
  }

  private async loadCommunities(sourceLimit: number): Promise<PromotedContentItem[]> {
    const snapshot = await getDocs(query(collection(db, 'communityVariantMembershipAndLikeCount'), orderBy('membershipCount', 'desc'), limit(sourceLimit)));
    const counts = snapshot.docs.map((countDocument) => {
      const data = countDocument.data();
      return {
        id: readText(data.communityVariantId) || countDocument.id,
        membershipCount: Number(data.membershipCount ?? 0) || 0,
      };
    });
    const communities = await Promise.all(counts.map(async ({ id, membershipCount }) => {
      try {
        const community = await getDoc(doc(db, 'communityVariant', id));
        if (!community.exists()) return null;
        const data = community.data();
        const item: PromotedContentItem = {
          id,
          title: readText(data.title) || readText(data.name) || 'Community',
          description: readText(data.description) || 'Join the discussion',
          category: 'Community',
          metric: `${membershipCount.toLocaleString()} ${membershipCount === 1 ? 'member' : 'members'}`,
          image: readText(data.imageUrl) || readText(data.imageURL) || readText(data.bannerImageUrl) || readText(data.communityImage),
        };
        return item;
      } catch {
        return null;
      }
    }));
    return communities.filter((community): community is PromotedContentItem => community !== null);
  }
}

export const promotedContentService = PromotedContentService.getInstance();
