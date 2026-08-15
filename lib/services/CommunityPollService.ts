import { ApiService } from './ApiService';
import type { CommunityPage, CommunityPoll } from '@/lib/types/community';

type ApiResult<TData> = { success?: boolean; data?: TData; error?: string };

export type CreateCommunityPollInput = {
  communityId: string;
  question: string;
  options: string[];
  durationHours: number;
  allowMultiple: boolean;
};

export class CommunityPollService {
  private static instance: CommunityPollService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): CommunityPollService {
    if (!CommunityPollService.instance) CommunityPollService.instance = new CommunityPollService();
    return CommunityPollService.instance;
  }

  public async fetchPolls(communityId: string): Promise<CommunityPage<CommunityPoll>> {
    const response = await this.apiService.request<ApiResult<CommunityPage<CommunityPoll>>>(`/api/communities/polls?communityId=${encodeURIComponent(communityId)}`, { authenticated: true });
    if (!response.success || !response.data) throw new Error(response.error || 'Community polls could not be loaded.');
    return response.data;
  }

  public async createPoll(input: CreateCommunityPollInput): Promise<string> {
    const response = await this.apiService.request<ApiResult<{ id: string }>>('/api/communities/polls', { method: 'POST', authenticated: true, body: input });
    if (!response.success || !response.data) throw new Error(response.error || 'Community poll could not be created.');
    return response.data.id;
  }

  public async vote(communityId: string, pollId: string, optionIndex: number): Promise<void> {
    const response = await this.apiService.request<ApiResult<never>>('/api/communities/polls', { method: 'PATCH', authenticated: true, body: { communityId, pollId, optionIndex } });
    if (!response.success) throw new Error(response.error || 'Your vote could not be saved.');
  }

  public async deletePoll(communityId: string, pollId: string): Promise<void> {
    const response = await this.apiService.request<ApiResult<never>>('/api/communities/polls', { method: 'DELETE', authenticated: true, body: { communityId, pollId } });
    if (!response.success) throw new Error(response.error || 'Community poll could not be deleted.');
  }
}

export const communityPollService = CommunityPollService.getInstance();
