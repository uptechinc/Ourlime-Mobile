import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import type { NotificationData, NotificationType } from '@/lib/types/notification';

export type NotificationEntityKind = 'user' | 'community' | 'blog' | 'product' | 'event' | 'course' | 'project' | 'system';

export type NotificationMediaInfo = {
  imageUrl: string | null;
  entityKind: NotificationEntityKind;
  displayName: string;
  initials: string;
  badgeIcon: string;
  badgeBg: string;
  badgeColor: string;
};

export class NotificationMediaResolverService {
  private static instance: NotificationMediaResolverService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly memoryCache = new Map<string, string | null>();
  private readonly pendingPromises = new Map<string, Promise<string | null>>();
  private readonly listeners = new Set<() => void>();

  private constructor() {}

  public static getInstance(): NotificationMediaResolverService {
    if (!NotificationMediaResolverService.instance) {
      NotificationMediaResolverService.instance = new NotificationMediaResolverService();
    }
    return NotificationMediaResolverService.instance;
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        this.logger.warn('NotificationMediaResolverService', 'listener-error', { error });
      }
    });
  }

  public getCachedMediaUrl(cacheKey: string): string | null | undefined {
    return this.memoryCache.get(cacheKey);
  }

  public setCachedMediaUrl(cacheKey: string, url: string | null): void {
    this.memoryCache.set(cacheKey, url);
  }

  public determineEntityKind(notification: NotificationData): NotificationEntityKind {
    const type = notification.type as string;
    const metadata = notification.metadata || {};

    if (
      type === 'community_invite' ||
      type === 'community_accepted' ||
      type === 'community_rejected' ||
      type === 'community_removed' ||
      type === 'community_report' ||
      type === 'role_change'
    ) {
      return 'community';
    }

    if (type === 'community_join_request') {
      if (notification.userDetails?.profileImage || metadata.sourceUserId) {
        return 'user';
      }
      return 'community';
    }

    if (type === 'blog' || metadata.blogId) {
      return 'blog';
    }

    if (
      type === 'marketplace_listing' ||
      type === 'listing_review' ||
      type === 'seller_review' ||
      metadata.marketplaceListingId ||
      metadata.productId
    ) {
      return 'product';
    }

    if (type === 'event' || type === 'event_cancelled' || metadata.eventId) {
      return 'event';
    }

    if (type === 'course' || metadata.courseId) {
      return 'course';
    }

    if (type === 'project_invite' || metadata.projectId) {
      return 'project';
    }

    if (
      type === 'child_safety_case' ||
      type === 'support_ticket' ||
      type === 'beta_management' ||
      type === 'report_action'
    ) {
      return 'system';
    }

    return 'user';
  }

  public getActionBadge(type: NotificationType | string): { icon: string; bg: string; color: string } {
    switch (type) {
      case 'like':
        return { icon: 'heart', bg: '#ef4444', color: '#ffffff' };
      case 'comment':
        return { icon: 'message-circle', bg: '#3b82f6', color: '#ffffff' };
      case 'repost':
        return { icon: 'repeat', bg: '#10b981', color: '#ffffff' };
      case 'mention':
        return { icon: 'at-sign', bg: '#8b5cf6', color: '#ffffff' };
      case 'friend_request':
        return { icon: 'user-plus', bg: '#3b82f6', color: '#ffffff' };
      case 'friend_accepted':
        return { icon: 'user-check', bg: '#10b981', color: '#ffffff' };
      case 'friend_declined':
        return { icon: 'user-x', bg: '#f43f5e', color: '#ffffff' };
      case 'follow':
        return { icon: 'user-plus', bg: '#06b6d4', color: '#ffffff' };
      case 'community_invite':
        return { icon: 'users', bg: '#f59e0b', color: '#ffffff' };
      case 'community_join_request':
        return { icon: 'user-plus', bg: '#3b82f6', color: '#ffffff' };
      case 'community_accepted':
        return { icon: 'check', bg: '#10b981', color: '#ffffff' };
      case 'community_rejected':
        return { icon: 'x', bg: '#f43f5e', color: '#ffffff' };
      case 'community_removed':
        return { icon: 'user-x', bg: '#f43f5e', color: '#ffffff' };
      case 'community_report':
        return { icon: 'flag', bg: '#ef4444', color: '#ffffff' };
      case 'report_action':
        return { icon: 'shield', bg: '#10b981', color: '#ffffff' };
      case 'event_cancelled':
        return { icon: 'calendar', bg: '#f43f5e', color: '#ffffff' };
      case 'event':
        return { icon: 'calendar', bg: '#ec4899', color: '#ffffff' };
      case 'project_invite':
        return { icon: 'folder', bg: '#8b5cf6', color: '#ffffff' };
      case 'marketplace_listing':
      case 'listing_review':
      case 'seller_review':
        return { icon: 'shopping-bag', bg: '#f97316', color: '#ffffff' };
      case 'blog':
        return { icon: 'book-open', bg: '#6366f1', color: '#ffffff' };
      case 'course':
        return { icon: 'book', bg: '#14b8a6', color: '#ffffff' };
      case 'child_safety_case':
      case 'support_ticket':
      case 'beta_management':
      default:
        return { icon: 'bell', bg: '#64748b', color: '#ffffff' };
    }
  }

  public extractInlinedImageUrl(notification: NotificationData, entityKind: NotificationEntityKind): string | null {
    const metadata = notification.metadata || {};
    const userDetails = notification.userDetails;

    const validUrl = (v: unknown): string | null => {
      if (typeof v === 'string' && v.trim().length > 0 && v !== '/images/avatar.jpg' && v !== '/images/transparentLogo.png') {
        return v.trim();
      }
      return null;
    };

    if (entityKind === 'user') {
      return (
        validUrl(userDetails?.profileImage) ||
        validUrl((userDetails as Record<string, unknown> | undefined)?.photoURL) ||
        validUrl(metadata.sourceProfileImage) ||
        validUrl(metadata.senderProfileImage) ||
        validUrl(metadata.actorProfileImage) ||
        validUrl(metadata.avatar) ||
        validUrl(metadata.avatarUrl) ||
        validUrl(metadata.photoURL) ||
        validUrl(metadata.profilePic) ||
        validUrl(metadata.imageUrl) ||
        null
      );
    }

    if (entityKind === 'community') {
      return (
        validUrl(metadata.communityAvatar) ||
        validUrl(metadata.communityBanner) ||
        validUrl(metadata.bannerImageUrl) ||
        validUrl(metadata.imageUrl) ||
        validUrl(metadata.coverImage) ||
        validUrl(metadata.image) ||
        validUrl(metadata.avatar) ||
        null
      );
    }

    if (entityKind === 'blog') {
      return (
        validUrl(metadata.blogCoverImage) ||
        validUrl(metadata.coverImage) ||
        validUrl(metadata.imageUrl) ||
        validUrl(metadata.image) ||
        validUrl(metadata.thumbnail) ||
        validUrl(userDetails?.profileImage) ||
        null
      );
    }

    if (entityKind === 'product') {
      return (
        validUrl(metadata.productImage) ||
        validUrl(metadata.imageUrl) ||
        validUrl(metadata.image) ||
        validUrl(metadata.thumbnail) ||
        null
      );
    }

    if (entityKind === 'event') {
      return (
        validUrl(metadata.eventImage) ||
        validUrl(metadata.coverImage) ||
        validUrl(metadata.bannerImageUrl) ||
        validUrl(metadata.imageUrl) ||
        validUrl(metadata.image) ||
        null
      );
    }

    if (entityKind === 'course') {
      return (
        validUrl(metadata.courseThumbnail) ||
        validUrl(metadata.thumbnail) ||
        validUrl(metadata.coverImage) ||
        validUrl(metadata.imageUrl) ||
        null
      );
    }

    if (entityKind === 'project') {
      return (
        validUrl(metadata.projectAvatar) ||
        validUrl(metadata.avatar) ||
        validUrl(metadata.imageUrl) ||
        validUrl(metadata.coverImage) ||
        null
      );
    }

    return (
      validUrl(userDetails?.profileImage) ||
      validUrl(metadata.sourceProfileImage) ||
      validUrl(metadata.imageUrl) ||
      validUrl(metadata.image) ||
      null
    );
  }

  public deriveDisplayName(notification: NotificationData, entityKind: NotificationEntityKind): { name: string; initials: string } {
    const metadata = notification.metadata || {};
    const userDetails = notification.userDetails;

    let name = '';
    if (entityKind === 'user') {
      const fullName = `${userDetails?.firstName || ''} ${userDetails?.lastName || ''}`.trim();
      name = fullName || userDetails?.userName || (typeof metadata.sourceUserName === 'string' ? metadata.sourceUserName : '') || notification.title || 'User';
    } else if (entityKind === 'community') {
      name = (typeof metadata.communityTitle === 'string' ? metadata.communityTitle : '') ||
        (typeof metadata.communityName === 'string' ? metadata.communityName : '') ||
        notification.title ||
        'Community';
    } else if (entityKind === 'blog') {
      name = (typeof metadata.blogTitle === 'string' ? metadata.blogTitle : '') ||
        (typeof metadata.contentTitle === 'string' ? metadata.contentTitle : '') ||
        notification.title ||
        'Blog';
    } else if (entityKind === 'product') {
      name = (typeof metadata.productTitle === 'string' ? metadata.productTitle : '') ||
        (typeof metadata.productName === 'string' ? metadata.productName : '') ||
        notification.title ||
        'Product';
    } else if (entityKind === 'event') {
      name = (typeof metadata.eventTitle === 'string' ? metadata.eventTitle : '') || notification.title || 'Event';
    } else if (entityKind === 'course') {
      name = (typeof metadata.courseTitle === 'string' ? metadata.courseTitle : '') || notification.title || 'Course';
    } else if (entityKind === 'project') {
      name = (typeof metadata.projectName === 'string' ? metadata.projectName : '') || notification.title || 'Project';
    } else {
      name = notification.title || 'Notification';
    }

    const trimmed = (name || '').trim();
    const parts = trimmed.split(/\s+/);
    const initials = parts.length >= 2
      ? `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
      : (trimmed.slice(0, 2).toUpperCase() || 'O');

    return { name, initials };
  }

  public resolveMedia(notification: NotificationData): NotificationMediaInfo {
    const entityKind = this.determineEntityKind(notification);
    let imageUrl = this.extractInlinedImageUrl(notification, entityKind);

    if (!imageUrl) {
      const cacheKey = this.getCacheKey(notification, entityKind);
      if (cacheKey && this.memoryCache.has(cacheKey)) {
        imageUrl = this.memoryCache.get(cacheKey) || null;
      }
    }

    const { name, initials } = this.deriveDisplayName(notification, entityKind);
    const badge = this.getActionBadge(notification.type);

    return {
      imageUrl,
      entityKind,
      displayName: name,
      initials,
      badgeIcon: badge.icon,
      badgeBg: badge.bg,
      badgeColor: badge.color,
    };
  }

  public getCacheKey(notification: NotificationData, entityKind: NotificationEntityKind): string | null {
    const metadata = notification.metadata || {};
    const sourceUserId = (typeof metadata.sourceUserId === 'string' && metadata.sourceUserId) ||
      (typeof metadata.sourceId === 'string' && metadata.sourceId) ||
      (typeof metadata.senderId === 'string' && metadata.senderId) ||
      (typeof metadata.actorUserId === 'string' && metadata.actorUserId) ||
      (typeof metadata.userId === 'string' && metadata.userId) ||
      (typeof metadata.authorId === 'string' && metadata.authorId) ||
      notification.userDetails?.uid ||
      notification.userDetails?.userId;

    if (entityKind === 'user' && sourceUserId) return `user_${sourceUserId}`;
    if (entityKind === 'community' && typeof metadata.communityId === 'string') return `community_${metadata.communityId}`;
    if (entityKind === 'blog' && typeof metadata.blogId === 'string') return `blog_${metadata.blogId}`;
    if (entityKind === 'product' && (typeof metadata.productId === 'string' || typeof metadata.marketplaceListingId === 'string')) {
      return `product_${metadata.productId || metadata.marketplaceListingId}`;
    }
    if (entityKind === 'event' && typeof metadata.eventId === 'string') return `event_${metadata.eventId}`;
    if (entityKind === 'course' && typeof metadata.courseId === 'string') return `course_${metadata.courseId}`;
    if (entityKind === 'project' && typeof metadata.projectId === 'string') return `project_${metadata.projectId}`;
    return null;
  }

  public isValidImageUrl(url: unknown): url is string {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (
      !trimmed ||
      trimmed === '/images/avatar.jpg' ||
      trimmed === '/images/transparentLogo.png'
    ) {
      return false;
    }
    return /^(https?:\/\/|data:image\/|\/)/i.test(trimmed);
  }

  public async resolveUserAvatarAsync(userId: string): Promise<string | null> {
    try {
      // 1. Authoritative active profile photo from profileImageSetAs
      const setAsQuery = query(
        collection(db, 'profileImageSetAs'),
        where('userId', '==', userId),
        limit(5)
      );
      const setAsSnap = await getDocs(setAsQuery);
      if (!setAsSnap.empty) {
        const docFound =
          setAsSnap.docs.find((d) => {
            const s = d.data()?.setAs;
            return s === 'profile' || s === 'postProfile';
          }) || setAsSnap.docs[0];
        let profileImageId = docFound.data()?.profileImageId;
        if (Array.isArray(profileImageId)) profileImageId = profileImageId[0];
        if (typeof profileImageId === 'string' && profileImageId) {
          const imgSnap = await getDoc(doc(db, 'profileImages', profileImageId));
          if (imgSnap.exists()) {
            const imgData = imgSnap.data();
            const url =
              (typeof imgData.imageURL === 'string' && imgData.imageURL) ||
              (typeof imgData.url === 'string' && imgData.url) ||
              (typeof imgData.imageUrl === 'string' && imgData.imageUrl) ||
              null;
            if (this.isValidImageUrl(url)) {
              return url.trim();
            }
          }
        }
      }

      // 2. Direct lookup in users collection
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        const directPic =
          (typeof data.profileImage === 'string' && data.profileImage) ||
          (data.profileImage && typeof data.profileImage === 'object' && 'imageURL' in data.profileImage && typeof (data.profileImage as { imageURL?: unknown }).imageURL === 'string' ? (data.profileImage as { imageURL: string }).imageURL : null) ||
          (typeof data.photoURL === 'string' && data.photoURL) ||
          (typeof data.avatar === 'string' && data.avatar) ||
          (typeof data.profilePicture === 'string' && data.profilePicture) ||
          null;
        if (this.isValidImageUrl(directPic)) {
          return directPic.trim();
        }
      }

      // 3. Direct query in profileImages collection
      const imagesQuery = query(
        collection(db, 'profileImages'),
        where('userId', '==', userId),
        limit(5)
      );
      const imagesSnap = await getDocs(imagesQuery);
      if (!imagesSnap.empty) {
        const profImg =
          imagesSnap.docs.find((d) => d.data()?.typeOfImage === 'profile') ||
          imagesSnap.docs[0];
        const imgData = profImg.data();
        const url =
          (typeof imgData.imageURL === 'string' && imgData.imageURL) ||
          (typeof imgData.url === 'string' && imgData.url) ||
          (typeof imgData.imageUrl === 'string' && imgData.imageUrl) ||
          null;
        if (this.isValidImageUrl(url)) {
          return url.trim();
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('NotificationMediaResolverService', 'resolveUserAvatarAsync-error', { error, userId });
      return null;
    }
  }

  public async resolveEntityMediaAsync(notification: NotificationData): Promise<string | null> {
    try {
      const metadata = (notification.metadata || {}) as Record<string, unknown>;

      // 1. Post context (likes, comments, reposts, mentions)
      const postId = (typeof metadata.postId === 'string' && metadata.postId) ||
        (typeof metadata.contentId === 'string' && metadata.contentId);
      if (postId) {
        let postSnap = await getDoc(doc(db, 'feedPosts', postId));
        if (!postSnap.exists()) {
          postSnap = await getDoc(doc(db, 'posts', postId));
        }
        if (postSnap.exists()) {
          const postData = postSnap.data();
          const mediaFiles = Array.isArray(postData.mediaFiles) ? postData.mediaFiles : [];
          const images = Array.isArray(postData.images) ? postData.images : [];
          const fileUrls = Array.isArray(postData.fileUrls) ? postData.fileUrls : [];
          const firstImage = images[0];
          const postImg =
            (typeof mediaFiles[0]?.url === 'string' && mediaFiles[0].url) ||
            (typeof postData.thumbnail === 'string' && postData.thumbnail) ||
            (typeof firstImage === 'string' ? firstImage : typeof firstImage?.url === 'string' ? firstImage.url : null) ||
            (typeof fileUrls[0] === 'string' && fileUrls[0]) ||
            (typeof postData.videoThumbnail === 'string' && postData.videoThumbnail) ||
            (typeof postData.postImage === 'string' && postData.postImage) ||
            (typeof postData.imageUrl === 'string' && postData.imageUrl) ||
            null;
          if (this.isValidImageUrl(postImg)) return postImg.trim();

          // If post is inside a community, fall back to community banner
          if (typeof postData.communityId === 'string' && postData.communityId) {
            const commSnap = await getDoc(doc(db, 'communityVariant', postData.communityId));
            if (commSnap.exists()) {
              const commData = commSnap.data();
              const commImg = (typeof commData.imageUrl === 'string' && commData.imageUrl) ||
                (typeof commData.bannerImageUrl === 'string' && commData.bannerImageUrl) ||
                (typeof commData.coverImage === 'string' && commData.coverImage) ||
                null;
              if (this.isValidImageUrl(commImg)) return commImg.trim();
            }
          }
        }
      }

      // 2. Community context
      const communityId = typeof metadata.communityId === 'string' ? metadata.communityId : '';
      if (communityId) {
        const communitySnap = await getDoc(doc(db, 'communityVariant', communityId));
        if (communitySnap.exists()) {
          const data = communitySnap.data();
          const img = (typeof data.imageUrl === 'string' && data.imageUrl) ||
            (typeof data.bannerImageUrl === 'string' && data.bannerImageUrl) ||
            (typeof data.coverImage === 'string' && data.coverImage) ||
            null;
          if (this.isValidImageUrl(img)) return img.trim();
        }
      }

      // 3. Blog context
      const blogId = typeof metadata.blogId === 'string' ? metadata.blogId : '';
      if (blogId) {
        let blogSnap = await getDoc(doc(db, 'blogsAndArticles', blogId));
        if (!blogSnap.exists()) {
          blogSnap = await getDoc(doc(db, 'blogs', blogId));
        }
        if (blogSnap.exists()) {
          const data = blogSnap.data();
          const img = (typeof data.coverImage === 'string' && data.coverImage) ||
            (typeof data.featuredImage === 'string' && data.featuredImage) ||
            (typeof data.imageUrl === 'string' && data.imageUrl) ||
            null;
          if (this.isValidImageUrl(img)) return img.trim();
        }
      }

      // 4. Product / Marketplace context
      const productId = (typeof metadata.productId === 'string' && metadata.productId) ||
        (typeof metadata.marketplaceListingId === 'string' && metadata.marketplaceListingId);
      if (productId) {
        const productSnap = await getDoc(doc(db, 'products', productId));
        if (productSnap.exists()) {
          const data = productSnap.data();
          const images = Array.isArray(data.images) ? data.images : [];
          const firstImage = images[0];
          const img = (typeof data.thumbnailImage === 'string' && data.thumbnailImage) ||
            (typeof data.imageUrl === 'string' && data.imageUrl) ||
            (typeof firstImage === 'string' ? firstImage : typeof firstImage?.url === 'string' ? firstImage.url : null) ||
            null;
          if (this.isValidImageUrl(img)) return img.trim();
        }
      }

      // 5. Event context
      const eventId = typeof metadata.eventId === 'string' ? metadata.eventId : '';
      if (eventId) {
        const eventSnap = await getDoc(doc(db, 'events', eventId));
        if (eventSnap.exists()) {
          const data = eventSnap.data();
          const img = (typeof data.coverImage === 'string' && data.coverImage) ||
            (typeof data.imageUrl === 'string' && data.imageUrl) ||
            (typeof data.bannerImageUrl === 'string' && data.bannerImageUrl) ||
            null;
          if (this.isValidImageUrl(img)) return img.trim();
        }
      }

      // 6. Course context
      const courseId = typeof metadata.courseId === 'string' ? metadata.courseId : '';
      if (courseId) {
        const courseSnap = await getDoc(doc(db, 'courses', courseId));
        if (courseSnap.exists()) {
          const data = courseSnap.data();
          const img = (typeof data.thumbnail === 'string' && data.thumbnail) ||
            (typeof data.coverImage === 'string' && data.coverImage) ||
            (typeof data.imageUrl === 'string' && data.imageUrl) ||
            null;
          if (this.isValidImageUrl(img)) return img.trim();
        }
      }

      // 7. Project context
      const projectId = typeof metadata.projectId === 'string' ? metadata.projectId : '';
      if (projectId) {
        const projectSnap = await getDoc(doc(db, 'projects', projectId));
        if (projectSnap.exists()) {
          const data = projectSnap.data();
          const img = (typeof data.coverImage === 'string' && data.coverImage) ||
            (typeof data.avatar === 'string' && data.avatar) ||
            (typeof data.imageUrl === 'string' && data.imageUrl) ||
            null;
          if (this.isValidImageUrl(img)) return img.trim();
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('NotificationMediaResolverService', 'resolveEntityMediaAsync-error', { error });
      return null;
    }
  }

  public async hydrateMediaAsync(notification: NotificationData): Promise<string | null> {
    const entityKind = this.determineEntityKind(notification);
    const inlined = this.extractInlinedImageUrl(notification, entityKind);
    if (inlined) return inlined;

    const cacheKey = this.getCacheKey(notification, entityKind);
    if (!cacheKey) return null;

    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey) || null;
    }

    if (this.pendingPromises.has(cacheKey)) {
      return this.pendingPromises.get(cacheKey)!;
    }

    const promise = (async (): Promise<string | null> => {
      try {
        const metadata = (notification.metadata || {}) as Record<string, unknown>;
        let resolvedUrl: string | null = null;

        if (entityKind === 'user') {
          const userId = (typeof metadata.sourceUserId === 'string' && metadata.sourceUserId) ||
            (typeof metadata.sourceId === 'string' && metadata.sourceId) ||
            (typeof metadata.senderId === 'string' && metadata.senderId) ||
            (typeof metadata.actorUserId === 'string' && metadata.actorUserId) ||
            (typeof metadata.userId === 'string' && metadata.userId) ||
            (typeof metadata.authorId === 'string' && metadata.authorId) ||
            notification.userDetails?.uid ||
            notification.userDetails?.userId;

          if (userId) {
            resolvedUrl = await this.resolveUserAvatarAsync(userId);
          }

          // Aggregation Fallback: If user has no avatar set, fall back to post / community / event media
          if (!resolvedUrl) {
            resolvedUrl = await this.resolveEntityMediaAsync(notification);
          }
        } else {
          // Entity kind first, with actor avatar fallback
          resolvedUrl = await this.resolveEntityMediaAsync(notification);

          if (!resolvedUrl) {
            const fallbackUserId = (typeof metadata.sourceUserId === 'string' && metadata.sourceUserId) ||
              (typeof metadata.sourceId === 'string' && metadata.sourceId) ||
              (typeof metadata.senderId === 'string' && metadata.senderId) ||
              (typeof metadata.actorUserId === 'string' && metadata.actorUserId) ||
              (typeof metadata.userId === 'string' && metadata.userId) ||
              notification.userDetails?.uid ||
              notification.userDetails?.userId;
            if (fallbackUserId) {
              resolvedUrl = await this.resolveUserAvatarAsync(fallbackUserId);
            }
          }
        }

        this.memoryCache.set(cacheKey, resolvedUrl);
        if (resolvedUrl) {
          this.notifyListeners();
        }
        return resolvedUrl;
      } catch (error) {
        this.logger.warn('NotificationMediaResolverService', 'hydrate-error', { error, cacheKey });
        this.memoryCache.set(cacheKey, null);
        return null;
      } finally {
        this.pendingPromises.delete(cacheKey);
      }
    })();

    this.pendingPromises.set(cacheKey, promise);
    return promise;
  }
}
