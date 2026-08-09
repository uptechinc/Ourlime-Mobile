import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import type { PostItem } from '@/lib/services/PostService';

interface CommunityPostCommentsModalProps {
  communityVariantDetailsId: string;
  onClose: () => void;
  onCommentAdded?: () => void;
}

const CommunityPostCommentsModal: React.FC<CommunityPostCommentsModalProps> = ({
  communityVariantDetailsId,
  onClose,
  onCommentAdded,
}) => {
  const [post, setPost] = useState<PostItem | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPostDetails = useCallback(async () => {
    try {
      let postRef = doc(db, 'communityVariantDetails', communityVariantDetailsId);
      let postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        postRef = doc(db, 'posts', communityVariantDetailsId);
        postDoc = await getDoc(postRef);
      }

      if (postDoc.exists()) {
        const postData = postDoc.data();
        const userId = postData.userId || postData.user?.id || auth.currentUser?.uid || '';

        let userObj = postData.user || {
          id: userId,
          firstName: postData.creatorName || 'User',
          lastName: '',
          userName: postData.creatorName?.toLowerCase().replace(/\s+/g, '') || 'user',
          profileImage: postData.creatorProfileImage || undefined,
        };

        if (userId && (!postData.user || !postData.user.firstName)) {
          const userSnap = await getDoc(doc(db, 'users', userId));
          if (userSnap.exists()) {
            const u = userSnap.data();
            userObj = {
              id: userId,
              firstName: u.firstName || 'User',
              lastName: u.lastName || '',
              userName: u.userName || 'user',
              profileImage: u.profilePicture || u.profileImage || undefined,
            };
          }
        }

        const media = (postData.mediaDetails || postData.media || []).map((m: any, idx: number) => ({
          id: m.id || `media-${idx}`,
          type: (m.type === 'video' ? 'video' : 'image') as 'image' | 'video',
          typeUrl: m.typeUrl || m.url || '',
          fileName: m.fileName || `file_${idx}`,
        }));

        const fullPost: PostItem = {
          id: postDoc.id,
          userId,
          user: userObj,
          type: postData.type || 'regular',
          caption: postData.caption || postData.title || '',
          description: postData.description || '',
          visibility: postData.visibility || 'public',
          hashtags: postData.hashtags || [],
          media,
          stats: {
            likes: postData.likesCount || postData.likeCount || 0,
            comments: postData.commentsCount || postData.commentCount || 0,
            shares: postData.sharesCount || 0,
          },
          likedUserIds: postData.likedUserIds || [],
          mentions: postData.mentions || [],
          friendReferences: postData.friendReferences || [],
          createdAt: postData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };

        setPost(fullPost);
      }
    } catch (err) {
      console.error('[MobileCommunityCommentsModal] error:', err);
    } finally {
      setLoading(false);
    }
  }, [communityVariantDetailsId]);

  useEffect(() => {
    void loadPostDetails();
  }, [loadPostDetails]);

  const currentUserId = auth.currentUser?.uid || '';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const activePost: PostItem = post || {
    id: communityVariantDetailsId,
    userId: currentUserId,
    user: {
      id: currentUserId,
      firstName: auth.currentUser?.displayName || 'User',
      lastName: '',
      userName: auth.currentUser?.email?.split('@')[0] || 'user',
      profileImage: auth.currentUser?.photoURL || undefined,
    },
    type: 'regular',
    caption: 'Community Post',
    description: '',
    visibility: 'public',
    hashtags: [],
    media: [],
    stats: { likes: 0, comments: 0, shares: 0 },
    likedUserIds: [],
    mentions: [],
    friendReferences: [],
    createdAt: new Date().toISOString(),
  };

  return (
    <CommentsModal
      post={activePost}
      userId={currentUserId}
      onClose={onClose}
      onPostUpdate={() => onCommentAdded?.()}
    />
  );
};

export default CommunityPostCommentsModal;
