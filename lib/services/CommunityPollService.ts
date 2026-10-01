import { communityDataService } from './CommunityDataService';
import type { CommunityPage, CommunityPoll } from '@/lib/types/community';

export type CreateCommunityPollInput = {
  communityId: string;
  question: string;
  options: string[];
  durationHours: number;
  allowMultiple: boolean;
};

/** Community polls read and written directly in Firestore (`polls`), same rules as the website. */
export class CommunityPollService {
  private static instance: CommunityPollService;
  private readonly data = communityDataService;

  private constructor() {}

  public static getInstance(): CommunityPollService {
    if (!CommunityPollService.instance) CommunityPollService.instance = new CommunityPollService();
    return CommunityPollService.instance;
  }

  public async fetchPolls(communityId: string): Promise<CommunityPage<CommunityPoll>> {
    return this.data.fetchPolls(communityId);
  }

  public async createPoll(input: CreateCommunityPollInput): Promise<string> {
    return this.data.createPoll(input);
  }

  public async vote(communityId: string, pollId: string, optionIndex: number): Promise<void> {
    await this.data.votePoll(communityId, pollId, optionIndex);
  }

  public async deletePoll(communityId: string, pollId: string): Promise<void> {
    await this.data.deletePoll(communityId, pollId);
  }
}

export const communityPollService = CommunityPollService.getInstance();
