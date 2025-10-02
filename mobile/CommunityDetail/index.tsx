import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { styles } from './styles';
import { mockCommunityData, mockPosts, mockMembers, mockCategories, mockPolls } from './data.mock';
import CreatePostModal from './components/CreatePostModal';
import CreateEventModal from './components/CreateEventModal';
import CreatePollModal from './components/CreatePollModal';
import EventsCarousel from './components/EventsCarousel';
import PollsCarousel from './components/PollsCarousel';
import CommentsModal from './components/CommentsModal';
import CommunitySidebar from './components/CommunitySidebar';

interface CommunityDetailProps {
  communityId: string;
  onNavigateToProfile?: (userId: string) => void;
  onNavigateToCommunities?: () => void;
}

export default function CommunityDetail({ 
  communityId, 
  onNavigateToProfile,
  onNavigateToCommunities 
}: CommunityDetailProps) {
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(76);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState(mockCommunityData.title);
  const [editDescription, setEditDescription] = useState(mockCommunityData.description);
  const [editIsPrivate, setEditIsPrivate] = useState(mockCommunityData.isPrivate);

  const handleLike = (postId: string) => {
    console.log('TODO: Handle like for post:', postId);
    setLikedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const handleCommunityLike = () => {
    console.log('TODO: Handle community like');
    setIsLiked(!isLiked);
    setLikeCount(prev => prev + (isLiked ? -1 : 1));
  };

  const handleEditSubmit = () => {
    console.log('TODO: Submit community edit');
    setIsEditFormOpen(false);
  };

  const handleCreatePost = () => {
    setIsPostModalOpen(true);
  };

  const handleCreateEvent = () => {
    setIsEventModalOpen(true);
  };

  const handleCreatePoll = () => {
    setIsPollModalOpen(true);
  };

  const handleShare = () => {
    console.log('TODO: Open share modal');
    setIsShareModalOpen(true);
  };

  const handleJoinCommunity = () => {
    console.log('TODO: Join community');
  };

  const handleRemoveUser = (userId: string) => {
    console.log('TODO: Remove user:', userId);
  };

  const handleBanUser = (userId: string) => {
    console.log('TODO: Ban user:', userId);
  };

  const handleDeletePost = (postId: string) => {
    console.log('TODO: Delete post:', postId);
  };

  const handleOpenComments = (postId: string) => {
    console.log('TODO: Open comments for post:', postId);
    setSelectedPostId(postId);
    setIsCommentsModalOpen(true);
  };

  const handleOpenSidebar = () => {
    setIsSidebarOpen(true);
  };

  const handleRefresh = () => {
    console.log('TODO: Refresh community data');
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };


  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={onNavigateToCommunities}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community</Text>
        <TouchableOpacity 
          onPress={handleOpenSidebar}
          style={styles.sidebarButton}
        >
          <Text style={styles.sidebarButtonText}>☰</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Community Header */}
        <View style={styles.headerCard}>
          <Text style={styles.communityTitle}>{mockCommunityData.title}</Text>
          <Text style={styles.communityDescription}>{mockCommunityData.description}</Text>
          
          <View style={styles.headerActions}>
            {!mockMembers.some(member => member.userId === 'current-user-id') && (
              <Pressable 
                onPress={handleJoinCommunity}
                style={styles.joinButton}
              >
                <Text style={styles.joinButtonText}>Join Community</Text>
              </Pressable>
            )}
            
            <Pressable 
              onPress={handleCommunityLike}
              style={styles.likeButton}
            >
              <Text style={[styles.likeButtonText, isLiked && styles.likedButtonText]}>
                {isLiked ? '❤️' : '🤍'} {likeCount}
              </Text>
            </Pressable>
            
            <Pressable 
              onPress={handleShare}
              style={styles.shareButton}
            >
              <Text style={styles.shareButtonText}>Share</Text>
            </Pressable>
          </View>

          {mockCommunityData.userId === 'current-user-id' && (
            <Pressable 
              onPress={() => setIsEditFormOpen(!isEditFormOpen)}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>
                {isEditFormOpen ? 'Cancel Edit' : 'Edit Community'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Edit Form */}
        {isEditFormOpen && (
          <View style={styles.editForm}>
            <Text style={styles.formLabel}>Community Title</Text>
            <TextInput
              style={styles.textInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Enter community title"
            />

            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Describe your community"
              multiline
              numberOfLines={4}
            />

            <View style={styles.checkboxContainer}>
              <Pressable 
                onPress={() => setEditIsPrivate(!editIsPrivate)}
                style={styles.checkbox}
              >
                <Text style={styles.checkboxText}>
                  {editIsPrivate ? '☑️' : '☐'} Make this community private
                </Text>
              </Pressable>
            </View>

            <View style={styles.formActions}>
              <Pressable 
                onPress={() => setIsEditFormOpen(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable 
                onPress={handleEditSubmit}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Pressable onPress={handleCreatePost} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Create Post +</Text>
          </Pressable>
          <Pressable onPress={handleCreateEvent} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Host Event +</Text>
          </Pressable>
          <Pressable onPress={handleCreatePoll} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Create Poll +</Text>
          </Pressable>
        </View>

        {/* Community Events Section */}
        <EventsCarousel 
          onEventPress={(eventId) => console.log('TODO: Navigate to event:', eventId)}
          onShare={(eventId) => handleShare()}
        />

        {/* Polls Section */}
        <PollsCarousel 
          onPollPress={(pollId) => console.log('TODO: Navigate to poll:', pollId)}
          onVote={(pollId, optionId) => console.log('TODO: Vote on poll:', pollId, 'option:', optionId)}
          onShare={(pollId) => handleShare()}
        />

        {/* Posts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community Posts</Text>
          <FlatList
            data={mockPosts}
            renderItem={({ item }) => (
              <View style={styles.postCard}>
                {/* Post Media */}
                {item.mediaDetails && (
                  <Image 
                    source={{ uri: item.mediaDetails.imageUrl }} 
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                )}

                {/* Post Content */}
                <View style={styles.postContent}>
                  <View style={styles.postHeader}>
                    <Image
                      source={{ uri: item.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face' }}
                      style={styles.authorAvatar}
                    />
                    <View style={styles.authorInfo}>
                      <Text style={styles.authorName}>
                        {item.author.firstName} {item.author.lastName}
                      </Text>
                      <Text style={styles.authorRole}>{item.author.role}</Text>
                    </View>
                  </View>

                  <Text style={styles.postTitle}>{item.title}</Text>
                  <Text style={styles.postText}>{item.content}</Text>

                  <View style={styles.postMeta}>
                    <Text style={styles.postTimestamp}>
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                    {mockCommunityData.userId === 'current-user-id' && (
                      <Pressable 
                        onPress={() => handleDeletePost(item.id)}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.postActions}>
                    <Pressable 
                      onPress={() => handleLike(item.id)}
                      style={styles.postActionButton}
                    >
                      <Text style={[
                        styles.postActionText,
                        likedPosts[item.id] && styles.likedText
                      ]}>
                        {likedPosts[item.id] ? '❤️ Liked' : '🤍 Like'}
                      </Text>
                    </Pressable>

                    <Pressable 
                      onPress={() => handleOpenComments(item.id)}
                      style={styles.postActionButton}
                    >
                      <Text style={styles.postActionText}>
                        💬 Comment ({item.commentCount || 0})
                      </Text>
                    </Pressable>

                    <Pressable 
                      onPress={() => handleShare()}
                      style={styles.postActionButton}
                    >
                      <Text style={styles.postActionText}>
                        📤 Share
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </View>

      </ScrollView>

      {/* Modals */}
      <CommunitySidebar
        isVisible={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNavigateToProfile={onNavigateToProfile}
        onRemoveUser={handleRemoveUser}
        onBanUser={handleBanUser}
      />

      <CreatePostModal 
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSubmit={(postData) => console.log('TODO: Submit post:', postData)}
      />

      <CreateEventModal 
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSubmit={(eventData) => console.log('TODO: Submit event:', eventData)}
      />

      <CreatePollModal 
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        onSubmit={(pollData) => console.log('TODO: Submit poll:', pollData)}
      />

      <CommentsModal
        isOpen={isCommentsModalOpen}
        onClose={() => setIsCommentsModalOpen(false)}
        postId={selectedPostId || ''}
      />

      <Modal visible={isShareModalOpen} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Community</Text>
            <Pressable 
              onPress={() => setIsShareModalOpen(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.modalContentContainer}>
            <Text style={styles.placeholderText}>Share options will appear here</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
