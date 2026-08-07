import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../styles';

interface Comment {
  id: string;
  author: {
    firstName: string;
    lastName: string;
    userName: string;
    profileImage?: string;
  };
  content: string;
  timestamp: string;
  likes: number;
  replies?: Comment[];
  parentId?: string;
}

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

export default function CommentsModal({ isOpen, onClose, postId }: CommentsModalProps) {
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [replyText, setReplyText] = useState('');
  const [commentText, setCommentText] = useState('');

  // Mock comments data
  const mockComments: Comment[] = [
    {
      id: '1',
      author: {
        firstName: 'Sarah',
        lastName: 'Johnson',
        userName: 'sarahj',
        profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
      },
      content: 'This is really helpful! Thanks for sharing these tips.',
      timestamp: '2h ago',
      likes: 12,
      replies: [
        {
          id: '1-1',
          author: {
            firstName: 'Mike',
            lastName: 'Chen',
            userName: 'mikec',
            profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
          },
          content: '@sarahj I totally agree! The performance improvements are amazing.',
          timestamp: '1h ago',
          likes: 5,
          parentId: '1',
        },
        {
          id: '1-2',
          author: {
            firstName: 'Alex',
            lastName: 'Wilson',
            userName: 'alexw',
            profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
          },
          content: '@sarahj @mikec Have you tried using React.memo? It made a huge difference for me.',
          timestamp: '45m ago',
          likes: 8,
          parentId: '1',
        },
      ],
    },
    {
      id: '2',
      author: {
        firstName: 'David',
        lastName: 'Brown',
        userName: 'davidb',
        profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
      },
      content: 'Great post! I\'ve been struggling with this exact issue.',
      timestamp: '3h ago',
      likes: 7,
      replies: [
        {
          id: '2-1',
          author: {
            firstName: 'Emma',
            lastName: 'Davis',
            userName: 'emmad',
            profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
          },
          content: '@davidb Same here! This solution is exactly what I needed.',
          timestamp: '2h ago',
          likes: 3,
          parentId: '2',
        },
      ],
    },
    {
      id: '3',
      author: {
        firstName: 'Lisa',
        lastName: 'Garcia',
        userName: 'lisag',
        profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
      },
      content: 'Can you share more examples of the optimization techniques?',
      timestamp: '4h ago',
      likes: 4,
    },
  ];

  const handleReply = (comment: Comment) => {
    setReplyTo(comment);
    setReplyText(`@${comment.author.userName} `);
  };

  const handleSubmitReply = () => {
    if (replyText.trim()) {
      console.log('TODO: Submit reply:', replyText);
      setReplyText('');
      setReplyTo(null);
    }
  };

  const handleSubmitComment = () => {
    if (commentText.trim()) {
      console.log('TODO: Submit comment:', commentText);
      setCommentText('');
    }
  };

  const renderComment = (comment: Comment, isReply: boolean = false) => (
    <View key={comment.id} style={[styles.commentItem, isReply && styles.replyItem]}>
      <Image
        source={{ uri: comment.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face' }}
        style={styles.commentAvatar}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>
            {comment.author.firstName} {comment.author.lastName}
          </Text>
          <Text style={styles.commentTime}>{comment.timestamp}</Text>
        </View>
        <Text style={styles.commentText}>{comment.content}</Text>
        <View style={styles.commentActions}>
          <Pressable style={styles.commentActionButton}>
            <Text style={styles.commentActionText}>❤️ {comment.likes}</Text>
          </Pressable>
          {!isReply && (
            <Pressable 
              onPress={() => handleReply(comment)}
              style={styles.commentActionButton}
            >
              <Text style={styles.commentActionText}>Reply</Text>
            </Pressable>
          )}
        </View>
        
        {/* Render replies */}
        {comment.replies && comment.replies.map((reply) => renderComment(reply, true))}
      </View>
    </View>
  );

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderContent}>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Comments</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        {/* Comments List */}
        <ScrollView 
          style={styles.modalContent}
          contentContainerStyle={styles.commentsContainer}
        >
          {mockComments.map((comment) => renderComment(comment))}
        </ScrollView>

        {/* Single Comment/Reply Input */}
        <View style={styles.commentInputContainer}>
          {replyTo && (
            <View style={styles.replyIndicator}>
              <Text style={styles.replyToText}>
                Replying to @{replyTo.author.userName}
              </Text>
              <TouchableOpacity 
                onPress={() => setReplyTo(null)}
                style={styles.cancelReplyButton}
              >
                <Text style={styles.cancelReplyText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentTextInput}
              value={replyTo ? replyText : commentText}
              onChangeText={replyTo ? setReplyText : setCommentText}
              placeholder={replyTo ? `Reply to @${replyTo.author.userName}...` : "Write a comment..."}
              multiline
              maxLength={500}
            />
            <TouchableOpacity 
              onPress={replyTo ? handleSubmitReply : handleSubmitComment}
              style={styles.commentSubmitButton}
            >
              <Text style={styles.commentSubmitText}>
                {replyTo ? 'Reply' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
