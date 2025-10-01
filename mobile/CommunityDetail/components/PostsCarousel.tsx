import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
} from 'react-native';
import { styles } from '../styles';
import { mockPosts } from '../data.mock';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const CARD_SPACING = 16;

interface PostsCarouselProps {
  onPostPress?: (postId: string) => void;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  likedPosts?: { [key: string]: boolean };
}

export default function PostsCarousel({ 
  onPostPress, 
  onLike, 
  onComment,
  likedPosts = {} 
}: PostsCarouselProps) {
  const handlePostPress = (postId: string) => {
    console.log('TODO: Navigate to post details:', postId);
    onPostPress?.(postId);
  };

  const handleLike = (postId: string) => {
    console.log('TODO: Like post:', postId);
    onLike?.(postId);
  };

  const handleComment = (postId: string) => {
    console.log('TODO: Open comments for post:', postId);
    onComment?.(postId);
  };

  const renderPost = (post: any, index: number) => (
    <Pressable
      key={post.id}
      onPress={() => handlePostPress(post.id)}
      style={[
        styles.postCarouselCard,
        { 
          width: CARD_WIDTH,
          marginLeft: index === 0 ? 0 : CARD_SPACING,
        }
      ]}
    >
      {/* Post Media */}
      {post.mediaDetails && (
        <Image 
          source={{ uri: post.mediaDetails.imageUrl }} 
          style={styles.postCarouselImage}
          resizeMode="cover"
        />
      )}

      {/* Post Content */}
      <View style={styles.postCarouselContent}>
        <View style={styles.postCarouselHeader}>
          <Image
            source={{ uri: post.author.profileImage || '/images/avatar.jpg' }}
            style={styles.postCarouselAvatar}
          />
          <View style={styles.postCarouselAuthorInfo}>
            <Text style={styles.postCarouselAuthorName}>
              {post.author.firstName} {post.author.lastName}
            </Text>
            <Text style={styles.postCarouselAuthorRole}>{post.author.role}</Text>
          </View>
        </View>

        <Text style={styles.postCarouselTitle} numberOfLines={2}>
          {post.title}
        </Text>
        <Text style={styles.postCarouselText} numberOfLines={3}>
          {post.content}
        </Text>

        <View style={styles.postCarouselMeta}>
          <Text style={styles.postCarouselTimestamp}>
            {new Date(post.timestamp).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.postCarouselActions}>
          <Pressable 
            onPress={() => handleLike(post.id)}
            style={styles.postCarouselActionButton}
          >
            <Text style={[
              styles.postCarouselActionText,
              likedPosts[post.id] && styles.likedText
            ]}>
              {likedPosts[post.id] ? '❤️' : '🤍'} {post.likeCount || 0}
            </Text>
          </Pressable>

          <Pressable 
            onPress={() => handleComment(post.id)}
            style={styles.postCarouselActionButton}
          >
            <Text style={styles.postCarouselActionText}>
              💬 {post.commentCount || 0}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  if (mockPosts.length === 0) {
    return (
      <View style={styles.postsCarouselContainer}>
        <Text style={styles.sectionTitle}>Community Posts</Text>
        <View style={styles.postsPlaceholder}>
          <Text style={styles.placeholderText}>No posts yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.postsCarouselContainer}>
      <Text style={styles.sectionTitle}>Community Posts</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.postsCarousel}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
      >
        {mockPosts.map((post, index) => renderPost(post, index))}
      </ScrollView>
    </View>
  );
}
