import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

export async function dispatchMentionNotifications({
  actorUserId,
  actorName,
  actorProfileImage,
  content,
  contentType,
  postId,
  commentId,
}: {
  actorUserId: string;
  actorName: string;
  actorProfileImage?: string;
  content: string;
  contentType: 'post' | 'comment' | 'lime';
  postId: string;
  commentId?: string;
}) {
  if (!content || !actorUserId) return;
  const mentions = Array.from(content.matchAll(/@([a-zA-Z0-9._]+)/g), (m) => m[1].toLowerCase());
  const uniqueMentions = [...new Set(mentions)].filter(Boolean);
  if (uniqueMentions.length === 0) return;

  try {
    for (const userName of uniqueMentions) {
      const q = query(collection(db, 'users'), where('userName', '==', userName));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const targetUserId = snap.docs[0].id;
        if (targetUserId !== actorUserId) {
          await addDoc(collection(db, `users/${targetUserId}/notifications`), {
            type: 'mention',
            title: 'Mentioned You',
            message: `${actorName} mentioned you in a ${contentType}`,
            isRead: false,
            read: false,
            sourceUserId: actorUserId,
            senderId: actorUserId,
            postId,
            commentId: commentId ?? null,
            contentType,
            createdAt: serverTimestamp(),
            userDetails: {
              userName: actorName,
              profileImage: actorProfileImage || null,
            },
          });
        }
      }
    }
  } catch (err) {
    console.error('[dispatchMentionNotifications] Error dispatching mention notifications:', err);
  }
}
