import { auth } from '@/lib/firebaseConfig';
import { contentDraftService } from './ContentDraftService';
import { nativeSessionService } from './NativeSessionService';
import { reliabilityDecoder } from './ReliabilityDecoderService';
import type { CommunityLinkResultStatus, CommunityProjectCard, CommunityProjectList, ProjectStatus } from '@/lib/types/project';

const PROJECT_STATUSES: readonly ProjectStatus[] = ['active', 'on-hold', 'completed', 'archived'];

/**
 * The Community side of eProjects Community links (website ProjectCommunityLinkService, mutateProjectMembership
 * community_link_*). Lists the projects a Community sponsors (safe fields only) and lets its owner and admins approve,
 * decline or remove links. The server checks every permission; being in the Community grants nothing on a project.
 */
export class CommunityProjectLinkService {
  private static instance: CommunityProjectLinkService;
  private readonly operations = new Map<string, string>();

  private constructor() {}

  public static getInstance(): CommunityProjectLinkService {
    if (!CommunityProjectLinkService.instance) CommunityProjectLinkService.instance = new CommunityProjectLinkService();
    return CommunityProjectLinkService.instance;
  }

  public async list(communityId: string): Promise<CommunityProjectList> {
    const result = await this.call(null, { action: 'community_link_list', communityId });
    return { active: this.cards(result.active), pending: this.cards(result.pending), canDecide: result.canDecide === true };
  }

  public async decide(communityId: string, projectId: string, decision: 'approve' | 'decline'): Promise<CommunityLinkResultStatus> {
    return this.status(await this.call(['decide', communityId, projectId, decision], { action: 'community_link_decide', communityId, projectId, decision }));
  }

  public async remove(communityId: string, projectId: string): Promise<CommunityLinkResultStatus> {
    return this.status(await this.call(['remove', communityId, projectId], { action: 'community_link_remove', communityId, projectId }));
  }

  /** Pure. One card as returned by the server, re-checked (unknown values fall back to safe defaults). */
  public card(value: unknown): CommunityProjectCard | null {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value as { [key: string]: unknown } : {};
    const projectId = typeof source.projectId === 'string' ? source.projectId : '';
    if (!projectId) return null;
    const projectStatus = PROJECT_STATUSES.find((status) => status === source.projectStatus) ?? 'archived';
    const progress = typeof source.progress === 'number' && Number.isFinite(source.progress) ? Math.min(100, Math.max(0, Math.round(source.progress))) : 0;
    const status = source.status === 'pending' || source.status === 'active' || source.status === 'declined' ? source.status : 'ended';
    return {
      projectId,
      projectName: typeof source.projectName === 'string' && source.projectName ? source.projectName : 'Untitled project',
      projectStatus,
      progress,
      ownerDisplayName: typeof source.ownerDisplayName === 'string' && source.ownerDisplayName ? source.ownerDisplayName : 'Project owner',
      status,
    };
  }

  private cards(value: unknown): CommunityProjectCard[] {
    return (Array.isArray(value) ? value : []).map((entry: unknown) => this.card(entry)).filter((card): card is CommunityProjectCard => card !== null);
  }

  private status(result: { [key: string]: unknown }): CommunityLinkResultStatus {
    const value = result.status;
    return value === 'pending' || value === 'active' || value === 'declined' || value === 'ended' ? value : 'none';
  }

  /** `identityParts` null for reads; changes keep one operation ID until the server answers definitely. */
  private async call(identityParts: unknown[] | null, input: { action: string; communityId: string; projectId?: string; decision?: string }): Promise<{ [key: string]: unknown }> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to continue.');
    await nativeSessionService.ensure(userId);
    const identity = identityParts ? JSON.stringify([userId, ...identityParts]) : null;
    const operationId = identity ? this.operations.get(identity) ?? await contentDraftService.newId() : null;
    if (identity && operationId) this.operations.set(identity, operationId);
    try {
      const { getFunctions, httpsCallable } = await import('@react-native-firebase/functions');
      const result = await httpsCallable(getFunctions(), 'mutateProjectMembership')({ ...input, ...(operationId ? { operationId } : {}) });
      nativeSessionService.assertOwner(userId);
      if (identity) this.operations.delete(identity);
      return reliabilityDecoder.object(result.data) as { [key: string]: unknown };
    } catch (error: unknown) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
      const definite = /(invalid-argument|failed-precondition|permission-denied|not-found|already-exists|aborted|unauthenticated)$/.test(code);
      if (identity && definite) this.operations.delete(identity);
      throw error;
    }
  }
}

export const communityProjectLinkService = CommunityProjectLinkService.getInstance();
