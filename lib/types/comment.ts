import type { Timestamp } from 'firebase/firestore';

export type Comment = {
    id: string;
    text: string;
    userId: string;
    userName: string;
    userAvatar: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
};

export type NewComment = Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>;

export type CommentModalProps = {
    reelId: string;
    isOpen: boolean;
    onClose: () => void;
}; 