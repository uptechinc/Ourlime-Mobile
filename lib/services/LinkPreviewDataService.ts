import { collection, doc, getDoc, getDocs, limit, query, where, type DocumentData, type DocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { accountLifecycleVisibilityService } from './AccountLifecycleVisibilityService';
import type {
  LinkPreviewData,
  OurlimeLinkPreviewEntity,
  SharedPostEventSummary,
  SharedPostLocation,
  SharedPostPollSummary,
  SharedPostPresentation,
  SharedPostPrimaryMedia,
  SharedPostYouTube,
} from './OpenGraphService';

type ShareDestination =
  | { kind: 'profile'; id: string }
  | { kind: 'community'; id: string }
  | { kind: 'lime'; id: string }
  | { kind: 'post'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'job'; id: string }
  | { kind: 'market-product'; id: string }
  | { kind: 'blog'; id: string };

type ShareEntity = {
  title: string;
  description: string;
  canonicalPath: string;
  siteName: string;
  imageUrl?: string;
  previewEntity?: Omit<OurlimeLinkPreviewEntity, 'kind' | 'id' | 'path'>;
};

type MediaSource = DocumentData & { fallbackOrder: number };

const DEFAULT_DESCRIPTION = 'Connect, share, and discover on Ourlime.';
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const URL_PATTERN = /https?:\/\/[^\s<]+/gi;

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const readFiniteNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const isObject = (value: unknown): value is { [key: string]: unknown } => typeof value === 'object' && value !== null && !Array.isArray(value);
const truncate = (value: string, maximumLength: number): string => (value.length <= maximumLength ? value : `${value.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`);
const unavailable = (kind: 'Post' | 'Lime', path: string, reason: 'deleted' | 'admin_taken_down' | 'unavailable'): ShareEntity => ({
  title: reason === 'admin_taken_down' ? `${kind} Removed` : reason === 'deleted' ? `${kind} Deleted` : 'Shared post unavailable',
  description: reason === 'admin_taken_down' ? `This ${kind} was removed by an admin.` : reason === 'deleted' ? `This ${kind} was deleted.` : 'Shared post unavailable',
  canonicalPath: path,
  siteName: kind === 'Post' ? 'Ourlime Posts' : 'Ourlime Limes',
  previewEntity: { unavailable: true, unavailableReason: reason },
});

/**
 * Link previews for Ourlime URLs, read directly from Firestore with the same rules as the website's
 * /api/link-preview route (ShareMetadataService + SharedPostPresentationService).
 */
export class LinkPreviewDataService {
  private static instance: LinkPreviewDataService;

  private constructor() {}

  public static getInstance(): LinkPreviewDataService {
    if (!LinkPreviewDataService.instance) LinkPreviewDataService.instance = new LinkPreviewDataService();
    return LinkPreviewDataService.instance;
  }

  public async getLinkPreview(sourceUrl: string): Promise<(Omit<LinkPreviewData, 'image'> & { imageUrl?: string }) | null> {
    const destination = this.resolveDestination(new URL(sourceUrl));
    if (!destination) return null;
    const entity = await this.getEntity(destination, auth.currentUser?.uid);
    if (!entity) return null;
    return {
      url: sourceUrl,
      title: entity.title,
      description: entity.description,
      ...(entity.imageUrl ? { imageUrl: entity.imageUrl } : {}),
      siteName: entity.siteName,
      entity: { kind: destination.kind, id: destination.id, path: entity.canonicalPath, ...entity.previewEntity },
    };
  }

  private resolveDestination(url: URL): ShareDestination | null {
    const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
    const root = segments[0]?.toLowerCase();
    if (root === 'profile' && segments[1]?.toLowerCase() === 'viewotherprofile' && segments[2]) return { kind: 'profile', id: segments[2].replace(/^@/, '') };
    if (root === 'profile' && segments[1]) return { kind: 'profile', id: segments[1].replace(/^@/, '') };
    if (root === 'communities' && segments[1]) return { kind: 'community', id: segments[1] };
    if ((root === 'limes' || root === 'lime') && segments[1]) return { kind: 'lime', id: segments[1] };
    if (root === 'post' || root === 'posts') {
      const postId = segments[1] || url.searchParams.get('id') || url.searchParams.get('postId') || url.searchParams.get('post');
      return postId ? { kind: 'post', id: postId } : null;
    }
    if (root === 'events') {
      const eventId = segments[1] || url.searchParams.get('targetId');
      return eventId ? { kind: 'event', id: eventId } : null;
    }
    if (root === 'jobs') {
      const jobId = segments[1] || url.searchParams.get('apply') || url.searchParams.get('job');
      return jobId ? { kind: 'job', id: jobId } : null;
    }
    if (root === 'market') {
      const productId = segments[1] || url.searchParams.get('product') || url.searchParams.get('productId');
      return productId ? { kind: 'market-product', id: productId } : null;
    }
    if (root === 'blogs' && segments[1]) return { kind: 'blog', id: segments[1] };
    return null;
  }

  private getEntity(destination: ShareDestination, viewerId?: string): Promise<ShareEntity | null> {
    switch (destination.kind) {
      case 'profile': return this.getProfile(destination.id);
      case 'community': return this.getCommunity(destination.id);
      case 'lime': return this.getLime(destination.id, viewerId);
      case 'post': return this.getPost(destination.id, viewerId);
      case 'event': return this.getEvent(destination.id);
      case 'job': return this.getJob(destination.id);
      case 'market-product': return this.getMarketProduct(destination.id);
      case 'blog': return this.getBlog(destination.id);
    }
  }

  private async firstExisting(collections: string[], id: string): Promise<DocumentSnapshot | null> {
    for (const collectionName of collections) {
      const snapshot = await getDoc(doc(db, collectionName, id));
      if (snapshot.exists()) return snapshot;
    }
    return null;
  }

  private async getProfile(username: string): Promise<ShareEntity | null> {
    const normalized = username.replace(/^@/, '').trim();
    if (!normalized) return null;
    let userDocument: DocumentSnapshot | null = await getDoc(doc(db, 'users', normalized));
    if (!userDocument.exists()) userDocument = (await getDocs(query(collection(db, 'users'), where('userName', '==', normalized), limit(1)))).docs[0] ?? null;
    if (!userDocument?.exists()) return null;
    const profile = userDocument.data() ?? {};
    if (profile.isDeleted === true || profile.deletedAt) return null;
    const resolvedUsername = readString(profile.userName) || normalized;
    const displayName = [readString(profile.firstName), readString(profile.lastName)].filter(Boolean).join(' ') || `@${resolvedUsername}`;
    const imageUrl = await this.resolveProfileImage(userDocument.id, profile, ['profile', 'postProfile']);
    return {
      title: `${displayName} (@${resolvedUsername}) | Ourlime`,
      description: truncate(readString(profile.bio) || `Check out @${resolvedUsername}'s profile on Ourlime.`, 160),
      canonicalPath: `/profile/${encodeURIComponent(resolvedUsername)}`,
      siteName: 'Ourlime Profiles',
      imageUrl: imageUrl || undefined,
    };
  }

  private async getCommunity(identifier: string): Promise<ShareEntity | null> {
    let communityDocument: DocumentSnapshot | null = await getDoc(doc(db, 'communityVariant', identifier));
    if (!communityDocument.exists()) communityDocument = (await getDocs(query(collection(db, 'communityVariant'), where('uniqueName', '==', identifier), limit(1)))).docs[0] ?? null;
    if (!communityDocument?.exists()) return null;
    const community = communityDocument.data() ?? {};
    const title = readString(community.title) || 'Ourlime Community';
    const slug = readString(community.uniqueName) || communityDocument.id;
    return {
      title: `${title} | Ourlime Communities`,
      description: truncate(readString(community.description) || `Join ${title} on Ourlime.`, 160),
      canonicalPath: `/communities/${encodeURIComponent(slug)}`,
      siteName: 'Ourlime Communities',
      imageUrl: readString(community.bannerImageUrl) || readString(community.imageUrl) || undefined,
    };
  }

  private async canViewerAccessMedia(ownerId: string, visibility: string, viewerId?: string): Promise<boolean> {
    if (!visibility || visibility === 'public') return true;
    if (!viewerId) return false;
    if (viewerId === ownerId) return true;
    if (visibility !== 'friends' && visibility !== 'friends_followers') return false;
    const [forward, reverse, following] = await Promise.all([
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', viewerId), where('userId2', '==', ownerId), limit(1))),
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', ownerId), where('userId2', '==', viewerId), limit(1))),
      visibility === 'friends_followers'
        ? getDocs(query(collection(db, 'followers'), where('followerId', '==', viewerId), where('followeeId', '==', ownerId), limit(1)))
        : Promise.resolve(null),
    ]);
    const isFriend = [...forward.docs, ...reverse.docs].some((friendship) => readString(friendship.data().friendshipStatus).toLowerCase() === 'accepted');
    return isFriend || Boolean(following && !following.empty);
  }

  private async canViewerAccessCommunityPost(communityId: string, ownerId: string, viewerId?: string): Promise<boolean> {
    if (!communityId) return false;
    const communityDocument = await getDoc(doc(db, 'communityVariant', communityId));
    if (!communityDocument.exists()) return false;
    const community = communityDocument.data();
    if (community.isPrivate !== true) return true;
    if (!viewerId) return false;
    if (viewerId === ownerId || viewerId === readString(community.userId)) return true;
    const [membership, viewer] = await Promise.all([
      getDocs(query(collection(db, 'communityVariantMembership'), where('communityVariantId', '==', communityId), where('userId', '==', viewerId), where('isMember', '==', true), limit(1))),
      getDoc(doc(db, 'users', viewerId)),
    ]);
    const viewerData = viewer.data() ?? {};
    return !membership.empty || viewerData.isAdmin === true || viewerData.role === 'admin' || viewerData.accountType === 'admin';
  }

  private removalReason(record: DocumentData): 'deleted' | 'admin_taken_down' | null {
    if (record.deletionSource === 'admin_moderation' || record.status === 'admin_deleted' || record.moderated === true || record.banned === true) return 'admin_taken_down';
    if (record.isDeleted === true || Boolean(record.deletedAt) || record.status === 'deleted') return 'deleted';
    return null;
  }

  private async creatorOf(record: DocumentData): Promise<{ profile: DocumentSnapshot | null; data: DocumentData; username: string; displayName: string; imageUrl: string }> {
    const profile = readString(record.userId) ? await getDoc(doc(db, 'users', readString(record.userId))) : null;
    const data = profile?.data() ?? {};
    const embeddedUser = isObject(record.user) ? record.user : {};
    const username = readString(embeddedUser.userName) || readString(data.userName) || 'user';
    const displayName = [readString(data.firstName), readString(data.lastName)].filter(Boolean).join(' ') || `@${username}`;
    const imageUrl = profile?.exists() ? await this.resolveProfileImage(profile.id, data, ['postProfile', 'profile']) : readString(embeddedUser.profileImage);
    return { profile, data, username, displayName, imageUrl };
  }

  private async getLime(limeId: string, viewerId?: string): Promise<ShareEntity | null> {
    const path = `/limes/${encodeURIComponent(limeId)}`;
    const limeDocument = await this.firstExisting(['reels', 'feedPosts', 'limes'], limeId);
    if (!limeDocument) return unavailable('Lime', path, 'deleted');
    const lime = limeDocument.data() ?? {};
    const removal = this.removalReason(lime);
    if (removal) return unavailable('Lime', path, removal);
    if (accountLifecycleVisibilityService.isHidden(lime)) return null;
    const media: DocumentData | undefined = Array.isArray(lime.media) ? lime.media[0] : isObject(lime.media) ? lime.media : undefined;
    const creator = await this.creatorOf(lime);
    const canExposeMedia = await this.canViewerAccessMedia(readString(lime.userId), readString(lime.visibility).toLowerCase(), viewerId);
    const mediaImage = media?.type === 'image' ? readString(media.typeUrl) || readString(media.url) : '';
    const thumbnailUrl = canExposeMedia
      ? readString(lime.thumbnailUrl) || readString(lime.posterUrl) || readString(media?.thumbnailUrl) || readString(media?.posterUrl) || mediaImage
      : '';
    const videoUrl = canExposeMedia && media?.type !== 'image' ? readString(media?.typeUrl) || readString(media?.url) : '';
    const caption = readString(lime.caption);
    const shortCaption = truncate(caption, 70);
    return {
      title: shortCaption ? `${shortCaption} | Lime by @${creator.username}` : `Lime by @${creator.username} | Ourlime`,
      description: truncate(caption || `Watch @${creator.username}'s Lime on Ourlime.`, 160),
      canonicalPath: path,
      siteName: 'Ourlime Limes',
      // The creator avatar stays in creatorImageUrl so a cover-less Lime still falls back to its first frame.
      imageUrl: thumbnailUrl || undefined,
      previewEntity: {
        thumbnailUrl: thumbnailUrl || undefined,
        videoUrl: videoUrl || undefined,
        creatorDisplayName: creator.displayName,
        creatorUsername: creator.username,
        creatorImageUrl: creator.imageUrl || undefined,
      },
    };
  }

  private async getPost(postId: string, viewerId?: string): Promise<ShareEntity | null> {
    const path = `/post/${encodeURIComponent(postId)}`;
    let postDocument = await getDoc(doc(db, 'feedPosts', postId));
    let isCommunityPost = !postDocument.exists();
    if (isCommunityPost) postDocument = await getDoc(doc(db, 'communityVariantDetails', postId));
    if (!postDocument.exists()) {
      postDocument = await getDoc(doc(db, 'posts', postId));
      isCommunityPost = false;
    }
    if (!postDocument.exists()) return unavailable('Post', path, 'deleted');
    const post = postDocument.data();
    const removal = this.removalReason(post);
    if (removal) return unavailable('Post', path, removal);
    if (accountLifecycleVisibilityService.isHidden(post)) return null;

    const embeddedMedia: DocumentData[] = Array.isArray(post.media) ? post.media : isObject(post.media) ? [post.media] : [];
    let mediaSnapshot = await getDocs(query(
      collection(db, isCommunityPost ? 'communityVariantDetailsSummary' : 'feedsPostSummary'),
      where(isCommunityPost ? 'communityVariantDetailsId' : 'feedsPostId', '==', postId),
    ));
    if (mediaSnapshot.empty && !isCommunityPost) mediaSnapshot = await getDocs(query(collection(db, 'feedsPostSummary'), where('postId', '==', postId)));
    const mediaSources: MediaSource[] = [
      ...embeddedMedia.map((mediaItem, index) => ({ ...mediaItem, fallbackOrder: index })),
      ...[...mediaSnapshot.docs].sort((left, right) => left.id.localeCompare(right.id)).map((mediaDocument, index) => ({
        ...mediaDocument.data(),
        id: mediaDocument.id,
        fallbackOrder: embeddedMedia.length + index,
      })),
    ];
    const presentation = this.createPostPresentation(post, mediaSources);
    const primaryMedia = presentation.primaryMedia;

    const creator = await this.creatorOf(post);
    if (creator.profile?.exists() && accountLifecycleVisibilityService.isHidden(creator.data)) return null;
    const ownerId = readString(post.userId);
    const canExposeMedia = isCommunityPost
      ? await this.canViewerAccessCommunityPost(readString(post.communityVariantId), ownerId, viewerId)
      : await this.canViewerAccessMedia(ownerId, readString(post.visibility).toLowerCase(), viewerId);
    if (!canExposeMedia) return unavailable('Post', path, 'unavailable');

    const thumbnailUrl = primaryMedia?.kind === 'image'
      ? primaryMedia.thumbnailUrl || primaryMedia.url
      : primaryMedia?.thumbnailUrl || presentation.youtube?.thumbnailUrl || '';
    const videoUrl = primaryMedia?.kind === 'video' ? primaryMedia.url : '';
    const caption = readString(post.caption) || readString(post.title) || readString(post.content);
    const shortCaption = truncate(caption, 70);
    return {
      title: shortCaption ? `${shortCaption} | Post by ${creator.displayName}` : `Post by ${creator.displayName} | Ourlime`,
      description: truncate(caption || `View @${creator.username}'s post on Ourlime.`, 160),
      canonicalPath: path,
      siteName: 'Ourlime Posts',
      imageUrl: thumbnailUrl || undefined,
      previewEntity: {
        thumbnailUrl: thumbnailUrl || undefined,
        videoUrl: videoUrl || undefined,
        creatorDisplayName: creator.displayName,
        creatorUsername: creator.username,
        creatorImageUrl: creator.imageUrl || undefined,
        post: presentation,
      },
    };
  }

  private async getEvent(eventId: string): Promise<ShareEntity | null> {
    const eventDocument = await getDoc(doc(db, 'events', eventId));
    if (!eventDocument.exists()) return null;
    const event = eventDocument.data();
    const title = readString(event.title) || 'Ourlime Event';
    const media: DocumentData[] = Array.isArray(event.media) ? event.media : [];
    const stillImage = media.find((mediaItem) => mediaItem?.type !== 'video');
    const imageUrl = readString(event.image) || readString(stillImage?.typeUrl) || readString(stillImage?.url);
    return {
      title: `${title} | Ourlime Events`,
      description: truncate(readString(event.summary) || readString(event.description) || `View ${title} on Ourlime.`, 160),
      canonicalPath: `/events/${encodeURIComponent(eventId)}`,
      siteName: 'Ourlime Events',
      imageUrl: imageUrl || undefined,
    };
  }

  private async getJob(jobId: string): Promise<ShareEntity | null> {
    const jobDocument = await getDoc(doc(db, 'jobs', jobId));
    if (!jobDocument.exists()) return null;
    const job = jobDocument.data();
    const basicInfo = isObject(job.basic_info) ? job.basic_info : {};
    const categoryInfo = isObject(job.category_specific) ? job.category_specific : {};
    const company = isObject(job.company) ? job.company : {};
    const status = readString(basicInfo.status);
    if (status && status !== 'published') return null;
    const title = readString(basicInfo.title) || 'Ourlime Job Opportunity';
    const companyName = readString(company.name) || readString(categoryInfo.companyName) || readString(categoryInfo.name);
    const location = basicInfo.location;
    const locationText = typeof location === 'string'
      ? location
      : isObject(location)
        ? readString(location.type).toLowerCase() === 'remote' ? 'Remote' : [readString(location.city), readString(location.country)].filter(Boolean).join(', ')
        : '';
    const creatorImage = isObject(job.creator) ? readString(job.creator.profileImage) : '';
    const profileImage = !creatorImage && readString(basicInfo.userId) ? await this.resolveProfileImage(readString(basicInfo.userId), undefined, ['jobProfile', 'profile']) : '';
    return {
      title: `${title} | Ourlime Jobs`,
      description: truncate(readString(basicInfo.description) || [companyName, locationText, 'View this opportunity on Ourlime.'].filter(Boolean).join(' • '), 160),
      canonicalPath: `/jobs/${encodeURIComponent(jobId)}`,
      siteName: 'Ourlime Jobs',
      imageUrl: readString(company.logo) || readString(categoryInfo.companyLogo) || readString(categoryInfo.logo) || creatorImage || profileImage || undefined,
    };
  }

  private async getMarketProduct(productId: string): Promise<ShareEntity | null> {
    const productDocument = await this.firstExisting(['products', 'marketProducts'], productId);
    if (!productDocument) return null;
    const product = productDocument.data() ?? {};
    const status = readString(product.status);
    if (status && status !== 'approved' && status !== 'active') return null;
    const title = readString(product.title) || readString(product.name) || 'Ourlime Marketplace Product';
    return {
      title: `${title} | Ourlime Marketplace`,
      description: truncate(readString(product.shortDescription) || readString(product.description) || readString(product.longDescription) || `View ${title} on Ourlime Marketplace.`, 160),
      canonicalPath: `/market/${encodeURIComponent(productId)}`,
      siteName: 'Ourlime Marketplace',
      imageUrl: readString(product.thumbnailImage) || readString(product.imageUrl) || readString(product.image) || undefined,
    };
  }

  private async getBlog(blogId: string): Promise<ShareEntity | null> {
    const blogDocument = await getDoc(doc(db, 'blogsAndArticles', blogId));
    if (!blogDocument.exists()) return null;
    const blog = blogDocument.data();
    if (readString(blog.status) !== 'published') return null;
    const title = readString(blog.title) || 'Ourlime Blog';
    return {
      title,
      description: truncate(readString(blog.metaDescription) || readString(blog.excerpt) || DEFAULT_DESCRIPTION, 160),
      canonicalPath: `/blogs/${encodeURIComponent(blogId)}`,
      siteName: 'Ourlime Blogs',
      imageUrl: readString(blog.ogImage) || readString(blog.coverImage) || undefined,
    };
  }

  private async resolveProfileImage(userId: string, profile: DocumentData | undefined, priorities: string[]): Promise<string> {
    const selections = await getDocs(query(collection(db, 'profileImageSetAs'), where('userId', '==', userId))).catch(() => null);
    for (const setAs of priorities) {
      const imageId = readString(selections?.docs.find((selection) => readString(selection.data().setAs) === setAs)?.data().profileImageId);
      if (!imageId) continue;
      const imageUrl = readString((await getDoc(doc(db, 'profileImages', imageId))).data()?.imageURL);
      if (imageUrl) return imageUrl;
    }
    const data = profile ?? (await getDoc(doc(db, 'users', userId))).data() ?? {};
    if (typeof data.profileImage === 'string') return readString(data.profileImage);
    return readString(data.profilePicture) || readString(data.avatar) || readString(data.photoURL) || (isObject(data.profileImage) ? readString(data.profileImage.imageURL) : '');
  }

  // ── Web SharedPostPresentationService.create ──

  private createPostPresentation(post: DocumentData, mediaSources: MediaSource[]): SharedPostPresentation {
    const sources: MediaSource[] = [...mediaSources];
    if (sources.length === 0) {
      if (Array.isArray(post.images)) {
        post.images.forEach((image: unknown, index: number) => {
          const url = typeof image === 'string' ? image : isObject(image) ? readString(image.url || image.typeUrl) : '';
          if (url) sources.push({ url, type: 'image', fallbackOrder: index });
        });
      }
      const pollData = isObject(post.pollData) ? post.pollData : {};
      const directImageUrl = readString(post.imageUrl) || readString(post.image) || readString(pollData.image);
      if (directImageUrl && !sources.some((item) => item.url === directImageUrl || item.typeUrl === directImageUrl)) {
        sources.push({ url: directImageUrl, type: 'image', fallbackOrder: sources.length });
      }
      const directVideoUrl = readString(post.videoUrl) || readString(post.video);
      if (directVideoUrl && !sources.some((item) => item.url === directVideoUrl || item.typeUrl === directVideoUrl)) {
        const directThumbnail = readString(post.thumbnailUrl) || readString(post.posterUrl);
        sources.push({ url: directVideoUrl, type: 'video', ...(directThumbnail ? { thumbnailUrl: directThumbnail } : {}), fallbackOrder: sources.length });
      }
    }
    const orderedMedia = sources
      .map((source) => this.normalizeMedia(source))
      .filter((media): media is SharedPostPrimaryMedia => media !== null)
      .sort((left, right) => left.displayOrder - right.displayOrder);
    const images = orderedMedia.filter((media) => media.kind === 'image');
    const videos = orderedMedia.filter((media) => media.kind === 'video');
    const primaryMedia = images[0] ?? videos[0];
    const excerpt = readString(post.caption) || readString(post.title) || readString(post.content) || readString(post.description);
    const subtype = post.type === 'poll' || post.type === 'event' ? post.type : 'regular';
    const youtube = this.resolveYouTube([excerpt, post.description, post.youtubeUrl, post.youtube, post.link, post.mediaLink, post.externalUrl, post.url].map(readString).filter(Boolean).join(' '));
    const location = this.normalizeLocation(post.location);
    const poll = subtype === 'poll' ? this.normalizePoll(post) : undefined;
    const event = subtype === 'event' ? this.normalizeEvent(post) : undefined;
    return {
      subtype,
      excerpt,
      ...(primaryMedia ? { primaryMedia } : {}),
      imageCount: images.length,
      videoCount: videos.length,
      ...(youtube ? { youtube } : {}),
      ...(location ? { location } : {}),
      ...(poll ? { poll } : {}),
      ...(event ? { event } : {}),
    };
  }

  private normalizeMedia(source: MediaSource): SharedPostPrimaryMedia | null {
    const url = readString(source.typeUrl) || readString(source.url) || readString(source.uri) || readString(source.imageUrl) || readString(source.image) || readString(source.videoUrl) || readString(source.video);
    if (!url) return null;
    const type = (readString(source.type) || readString(source.mediaType)).toLowerCase();
    const nestedMedia = isObject(source.media) ? source.media : undefined;
    const thumbnailUrl = readString(source.thumbnailUrl) || readString(source.posterUrl) || readString(nestedMedia?.thumbnailUrl) || readString(nestedMedia?.posterUrl);
    return {
      kind: type === 'video' || /\.(mp4|webm|mov|m4v)(?:$|[?#])/i.test(url) ? 'video' : 'image',
      url,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      displayOrder: readFiniteNumber(source.displayOrder) ?? source.fallbackOrder,
    };
  }

  private resolveYouTube(text: string): SharedPostYouTube | undefined {
    for (const match of text.match(URL_PATTERN) ?? []) {
      const candidate = match.replace(/[),.!?;:\]}]+$/, '');
      try {
        const url = new URL(candidate);
        const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
        const segments = url.pathname.split('/').filter(Boolean);
        let videoId = hostname === 'youtu.be' ? segments[0] ?? '' : '';
        if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(hostname)) {
          videoId = url.pathname === '/watch' ? url.searchParams.get('v') ?? '' : ['embed', 'shorts', 'live'].includes(segments[0] ?? '') ? segments[1] ?? '' : '';
        }
        if (YOUTUBE_ID_PATTERN.test(videoId)) return { videoId, url: candidate, thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` };
      } catch {
        continue;
      }
    }
    return undefined;
  }

  private normalizeLocation(value: unknown): SharedPostLocation | undefined {
    if (typeof value === 'string' && value.trim()) {
      const name = value.trim();
      return /^https?:\/\//i.test(name) ? { name: 'Online', url: name } : { name };
    }
    if (!isObject(value)) return undefined;
    const name = readString(value.name) || readString(value.address);
    if (!name) return undefined;
    const coordinates = isObject(value.coordinates) ? value.coordinates : undefined;
    const latitude = readFiniteNumber(value.lat) ?? readFiniteNumber(value.latitude) ?? readFiniteNumber(coordinates?.latitude);
    const longitude = readFiniteNumber(value.lng) ?? readFiniteNumber(value.longitude) ?? readFiniteNumber(coordinates?.longitude);
    return {
      name,
      ...(readString(value.address) ? { address: readString(value.address) } : {}),
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(readString(value.url) ? { url: readString(value.url) } : {}),
    };
  }

  private normalizePoll(post: DocumentData): SharedPostPollSummary | undefined {
    const rawOptions: unknown = post.pollOptions ?? (isObject(post.pollData) ? post.pollData.options : undefined);
    if (!Array.isArray(rawOptions)) return undefined;
    const options = rawOptions.flatMap((option): string[] => {
      if (typeof option === 'string' && option.trim()) return [option.trim()];
      const text = isObject(option) ? readString(option.text) : '';
      return text ? [text] : [];
    }).slice(0, 4);
    if (options.length === 0) return undefined;
    const endTime = readString(post.pollEndTime);
    return { options, totalVotes: isObject(post.pollVotes) ? Object.keys(post.pollVotes).length : 0, ended: Boolean(endTime && Date.parse(endTime) <= Date.now()) };
  }

  private normalizeEvent(post: DocumentData): SharedPostEventSummary | undefined {
    const startDate = readString(post.startDate);
    const endDate = readString(post.endDate);
    const category = readString(post.category);
    return startDate || endDate || category ? { ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}), ...(category ? { category } : {}) } : undefined;
  }
}

export const linkPreviewDataService = LinkPreviewDataService.getInstance();
