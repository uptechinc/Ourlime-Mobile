import { AuthService } from './AuthService';
import { postAuthorizationService } from './PostAuthorizationService';
import { PostService, type PostItem } from './PostService';
import { isCancellationError } from './PostMediaService';
import { EventService } from './EventService';
import { FeedResourceService } from './FeedResourceService';
import { CommunityFeedResourceService } from './CommunityFeedResourceService';
import { ProfileResourceService } from './ProfileResourceService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { dispatchMentionNotifications } from './dispatchMentionNotifications';
import { usePostSubmissionStore } from '@/lib/store/usePostSubmissionStore';
import type { PostSubmissionDraft, PostSubmissionSnapshot } from '@/lib/types/postSubmission';

type SubmissionTask = {
  id: string;
  draft: PostSubmissionDraft;
  controller: AbortController;
  startedAt: number;
  lastProgressAt: number;
  publishAttempted: boolean;
  eventCreated: boolean;
};

export class PostSubmissionService {
  private static instance: PostSubmissionService;
  private readonly authService = AuthService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();
  private task: SubmissionTask | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listening = false;

  private constructor() {}

  public static getInstance(): PostSubmissionService {
    if (!PostSubmissionService.instance) PostSubmissionService.instance = new PostSubmissionService();
    return PostSubmissionService.instance;
  }

  public start(draft: PostSubmissionDraft): void {
    if (this.authService.getCurrentUser()?.uid !== draft.post.userId) throw new Error('Please sign in again before posting.');
    if (!postAuthorizationService.canCreatePost(draft.post.user)) {
      throw new Error('You must verify your account before you can create a post.');
    }
    if (usePostSubmissionStore.getState().submission?.status === 'running') throw new Error('A post is already uploading. You can check its progress on Feeds.');
    if (!this.listening) {
      this.listening = true;
      this.authService.subscribeToAuthState((user) => {
        if (this.task && user?.uid !== this.task.draft.post.userId) {
          this.task.controller.abort();
          this.task = null;
          this.stopTimer();
          usePostSubmissionStore.setState({ submission: null });
        }
      });
    }
    // Snapshot editable arrays before the composer unmounts or a new draft opens.
    const post = draft.post;
    this.task = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      draft: { event: draft.event ? { ...draft.event, user: { ...draft.event.user } } : undefined, post: {
        ...post, user: { ...post.user }, media: post.media.map((item) => ({ ...item })),
        hashtags: [...post.hashtags], mentions: [...post.mentions], friendReferences: [...post.friendReferences],
        pollOptions: post.pollOptions?.map((option) => ({ ...option })), location: post.location ? { ...post.location } : undefined,
      } },
      controller: new AbortController(), startedAt: Date.now(), lastProgressAt: Date.now(), publishAttempted: false, eventCreated: false,
    };
    this.launch(this.task);
  }

  public retry(): void {
    const task = this.task;
    if (!task || !usePostSubmissionStore.getState().submission?.canRetry || this.authService.getCurrentUser()?.uid !== task.draft.post.userId) return;
    const retryTask = { ...task, controller: new AbortController(), startedAt: Date.now(), lastProgressAt: Date.now(), publishAttempted: false };
    this.task = retryTask;
    this.launch(retryTask);
  }

  public cancel(): void {
    if (!this.task || !usePostSubmissionStore.getState().submission?.canCancel) return;
    this.task.controller.abort();
    this.patch(this.task, { canCancel: false, message: 'Cancelling upload…' });
  }

  public dismiss(): void {
    if (usePostSubmissionStore.getState().submission?.status === 'running') return;
    this.task = null;
    usePostSubmissionStore.setState({ submission: null });
  }

  public describe(snapshot: PostSubmissionSnapshot): string {
    if (snapshot.status === 'completed') return 'Your post is ready in the feed.';
    if (snapshot.status !== 'running') return snapshot.canRetry ? 'Your draft is kept for retry while this app stays open.' : 'You can dismiss this message.';
    const minutes = Math.floor(snapshot.elapsedSeconds / 60);
    const elapsed = minutes ? `${minutes}m ${snapshot.elapsedSeconds % 60}s` : `${snapshot.elapsedSeconds}s`;
    const bytes = snapshot.totalBytes > 0 ? `${(snapshot.completedBytes / 1048576).toFixed(1)} / ${(snapshot.totalBytes / 1048576).toFixed(1)} MB` : '';
    const count = snapshot.mediaCount && snapshot.stage !== 'publishing' ? `File ${snapshot.mediaIndex + 1} of ${snapshot.mediaCount}` : '';
    return [snapshot.stage === 'uploading' ? `${snapshot.percentage}% uploaded` : '', count, bytes, elapsed].filter(Boolean).join(' · ');
  }

  private launch(task: SubmissionTask): void {
    const media = task.draft.post.media;
    usePostSubmissionStore.setState({ submission: {
      id: task.id, userId: task.draft.post.userId, status: 'running', stage: 'preparing', mediaIndex: 0,
      mediaCount: media.length, thumbnailUri: media[0]?.thumbnailUri ?? (media[0]?.type === 'image' ? media[0].uri : undefined),
      percentage: 0, completedBytes: 0, totalBytes: media.reduce((sum, item) => sum + (item.fileSize ?? 0), 0),
      elapsedSeconds: 0, isSlow: false, message: 'Preparing your post…', canCancel: true, canRetry: false,
    } });
    this.stopTimer();
    this.timer = setInterval(() => {
      if (this.task !== task || usePostSubmissionStore.getState().submission?.status !== 'running') return;
      const isSlow = Date.now() - task.lastProgressAt >= 30_000;
      this.patch(task, { elapsedSeconds: Math.floor((Date.now() - task.startedAt) / 1000), isSlow });
    }, 1000);
    void this.run(task);
  }

  private async run(task: SubmissionTask): Promise<void> {
    this.logger.info('PostSubmissionService', 'start', { submissionId: task.id, mediaCount: task.draft.post.media.length });
    try {
      if (task.draft.event && !task.eventCreated) {
        task.publishAttempted = true;
        this.patch(task, { stage: 'publishing', canCancel: false, message: 'Creating event…' });
        await EventService.getInstance().createEvent(task.draft.event);
        task.eventCreated = true;
        task.publishAttempted = false;
      }
      if (task.controller.signal.aborted || this.task !== task) throw new Error('Post submission cancelled.');
      const post = await PostService.getInstance().createPost({
        ...task.draft.post, signal: task.controller.signal,
        onStage: (stage, index) => {
          if (this.task !== task || usePostSubmissionStore.getState().submission?.status !== 'running') return;
          if (stage === 'publishing') task.publishAttempted = true;
          task.lastProgressAt = Date.now();
          const message = stage === 'preparing' ? 'Reading media…' : stage === 'uploading' ? 'Uploading media…' : stage === 'cover' ? 'Preparing video cover…' : 'Publishing post…';
          this.patch(task, { stage, mediaIndex: index ?? 0, message, canCancel: stage !== 'publishing', isSlow: false });
          this.logger.info('PostSubmissionService', 'stage', { submissionId: task.id, stage, index });
        },
        onUploadProgress: (progress) => {
          const current = usePostSubmissionStore.getState().submission;
          if (this.task !== task || current?.status !== 'running') return;
          if (progress.completedBytes !== current?.completedBytes) task.lastProgressAt = Date.now();
          this.patch(task, { ...progress, percentage: Number.isFinite(progress.percentage) ? Math.min(100, Math.max(0, progress.percentage)) : 0, isSlow: Date.now() - task.lastProgressAt >= 30_000 });
        },
      });
      if (this.task !== task || this.authService.getCurrentUser()?.uid !== task.draft.post.userId) return;
      // Publication succeeded. Cache/notification failures must never offer a
      // retry which would create a second post.
      this.patch(task, { status: 'completed', message: 'Post published', percentage: 100, canCancel: false, canRetry: false, isSlow: false });
      this.stopTimer();
      this.logger.success('PostSubmissionService', 'published', { submissionId: task.id, postId: post.id });
      await this.reconcile(task, post).catch((error: unknown) => this.logger.error('PostSubmissionService', 'reconcile', error, { submissionId: task.id, postId: post.id }));
    } catch (error: unknown) {
      if (this.task !== task) return;
      const cancelled = task.controller.signal.aborted || isCancellationError(error, task.controller.signal);
      const message = cancelled ? 'Upload cancelled' : task.publishAttempted
        ? 'Could not confirm publication. You can retry, or check your feed first.'
        : error instanceof Error ? error.message : 'Upload failed. Please try again.';
      this.patch(task, { status: cancelled ? 'cancelled' : 'failed', message, canCancel: false, canRetry: !cancelled, isSlow: false });
      if (cancelled) {
        this.logger.info('PostSubmissionService', 'cancelled', { submissionId: task.id, publishAttempted: task.publishAttempted });
      } else {
        this.logger.error('PostSubmissionService', 'failed', error, { submissionId: task.id, publishAttempted: task.publishAttempted, cancelled: false });
      }
    } finally {
      if (this.task === task) this.stopTimer();
    }
  }

  private async reconcile(task: SubmissionTask, post: PostItem): Promise<void> {
    const userId = task.draft.post.userId;
    const feed = FeedResourceService.getInstance();
    const operations = [feed.publishCreated(userId, post)];
    if (post.communityId) {
      operations.push(CommunityFeedResourceService.getInstance().prepend(userId, post.communityId, post));
    } else operations.push(ProfileResourceService.getInstance().adjustOwnStats(userId, { posts: 1 }));
    operations.push(dispatchMentionNotifications({ actorUserId: userId, actorName: post.user.userName || post.user.firstName,
      actorProfileImage: post.user.profileImage, content: task.draft.post.caption, contentType: 'post', postId: post.id }));
    await Promise.all(operations);
  }

  private patch(task: SubmissionTask, update: Partial<PostSubmissionSnapshot>): void {
    const current = usePostSubmissionStore.getState().submission;
    if (this.task !== task || current?.id !== task.id) return;
    usePostSubmissionStore.setState({ submission: { ...current, ...update } });
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export const postSubmissionService = PostSubmissionService.getInstance();
