import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CommunityService, type CommunitySummary } from '@/lib/services/CommunityService';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { PostService, type PostItem } from '@/lib/services/PostService';
import PostCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostCardSection';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import CreatePostModal from '@/components/home/MiddleSection/MiddleSectionComponent/CreatePostModal';
import CustomModal from '@/components/ui/CustomModal';
import { ModerationService } from '@/lib/services/ModerationService';
import CachedImage from '@/components/ui/CachedImage';

type CommunityTab = 'posts' | 'about';

const communityService = CommunityService.getInstance();
const authService = AuthService.getInstance();
const postService = PostService.getInstance();
const moderationService = ModerationService.getInstance();

type CommunityAction = 'leave' | 'report';
type CommunityActionModal = { visible: boolean; action: CommunityAction | null; title: string; message: string };

export default function CommunityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [community, setCommunity] = useState<CommunitySummary | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CommunityTab>('posts');
  const [createVisible, setCreateVisible] = useState(false);
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<CommunityActionModal>({ visible: false, action: null, title: '', message: '' });

  const loadCommunity = useCallback(async (refresh = false) => {
    if (!id) return;
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const nextCommunity = await communityService.fetchCommunity(id);
      setCommunity(nextCommunity);
      const userId = authService.getCurrentUser()?.uid;
      const [nextProfile, nextPosts] = await Promise.all([
        userId ? authService.getUserProfile(userId) : Promise.resolve(null),
        nextCommunity.hasAccess ? postService.fetchCommunityPosts(nextCommunity.id) : Promise.resolve([]),
      ]);
      setProfile(nextProfile);
      setPosts(nextPosts);
    } catch (loadError: unknown) {
      console.error('[CommunityDetailScreen.loadCommunity]', loadError);
      setError(loadError instanceof Error ? loadError.message : 'This community could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { void loadCommunity(); }, [loadCommunity]);

  const activePost = useMemo(() => posts.find((post) => post.id === activePostId) ?? null, [activePostId, posts]);
  const canPost = Boolean(community && profile && community.hasAccess && (
    community.isOwner || (community.postingPermission === 'members' && community.isMember)
  ));

  const handleJoin = async () => {
    if (!community || joining) return;
    setJoining(true);
    try {
      const result = await communityService.joinOrRequestAccess(community);
      setCommunity((current) => current ? {
        ...current,
        isMember: result === 'joined',
        requestStatus: result === 'requested' ? 'pending' : current.requestStatus,
        membershipCount: current.membershipCount + (result === 'joined' ? 1 : 0),
      } : current);
      setMessage(result === 'joined' ? 'You joined this community.' : 'Your request was sent to the community administrators.');
    } catch (joinError: unknown) {
      setMessage(joinError instanceof Error ? joinError.message : 'Community membership could not be updated');
    } finally {
      setJoining(false);
    }
  };

  const handlePostUpdate = (updatedPost: PostItem) => setPosts((current) => current.map((post) => post.id === updatedPost.id ? updatedPost : post));

  const handleShare = async () => {
    if (!community) return;
    await Share.share({ message: `Join ${community.title} on Ourlime: https://ourlime.com/communities/${community.id}` });
  };

  const handleCommunityAction = async () => {
    if (!community || !actionModal.action || joining) return;
    setJoining(true);
    try {
      if (actionModal.action === 'leave') {
        await communityService.leaveCommunity(community.id);
        setCommunity((current) => current ? { ...current, isMember: false, hasAccess: !current.isPrivate, membershipCount: Math.max(0, current.membershipCount - 1) } : current);
        setMessage('You left this community.');
      } else {
        await moderationService.reportCommunity({ targetId: community.id, reasonCategory: 'other', reason: 'Community guideline violation', routePath: `/communities/${community.id}` });
        setMessage('Your report was sent to the Ourlime moderation team.');
      }
      setActionModal({ visible: false, action: null, title: '', message: '' });
    } catch (actionError: unknown) {
      setMessage(actionError instanceof Error ? actionError.message : 'The community action could not be completed.');
    } finally { setJoining(false); }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }} accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#0f172a" /></TouchableOpacity>
        <Text numberOfLines={1} style={{ flex: 1, marginLeft: 10, fontSize: 18, fontWeight: '800', color: '#0f172a' }}>{community?.title || 'Community'}</Text>
        {community ? <><TouchableOpacity onPress={() => void handleShare()} style={{ padding: 6 }} accessibilityLabel="Share community"><Ionicons name="share-outline" size={21} color="#475569" /></TouchableOpacity><TouchableOpacity onPress={() => setActionModal({ visible: true, action: 'report', title: 'Report this community?', message: 'Ourlime moderators will review the community for guideline violations.' })} style={{ padding: 6 }} accessibilityLabel="Report community"><Ionicons name="flag-outline" size={20} color="#475569" /></TouchableOpacity></> : null}
      </View>
      {loading ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#10b981" /></View> : error || !community ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}><Text style={{ color: '#475569', textAlign: 'center' }}>{error || 'Community not found.'}</Text><TouchableOpacity onPress={() => void loadCommunity()} style={{ marginTop: 15, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, backgroundColor: '#10b981' }}><Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text></TouchableOpacity></View> : <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadCommunity(true)} tintColor="#10b981" />} contentContainerStyle={{ paddingBottom: 40 }}>
        {community.imageUrl ? <CachedImage uri={community.imageUrl} recyclingKey={`community-cover-${community.id}-${community.imageUrl}`} style={{ width: '100%', height: 220 }} contentFit="cover" /> : <View style={{ height: 180, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d1fae5' }}><Ionicons name="people" size={54} color="#10b981" /></View>}
        <View style={{ backgroundColor: '#fff', padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1, fontSize: 24, fontWeight: '900', color: '#0f172a' }}>{community.title}</Text>{community.isPrivate ? <Ionicons name="lock-closed" size={18} color="#64748b" /> : null}</View>
          <Text style={{ color: '#059669', fontWeight: '800', marginTop: 8 }}>{community.membershipCount.toLocaleString()} members</Text>
          {community.isBanned ? <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#fee2e2' }}><Text style={{ color: '#991b1b', fontWeight: '800' }}>You are banned from this community.</Text></View> : !community.isMember && !community.isOwner ? <TouchableOpacity disabled={joining || community.requestStatus === 'pending'} onPress={() => void handleJoin()} style={{ marginTop: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: community.requestStatus === 'pending' ? '#e2e8f0' : '#10b981' }}>{joining ? <ActivityIndicator color="#fff" /> : <Text style={{ color: community.requestStatus === 'pending' ? '#64748b' : '#fff', fontWeight: '900' }}>{community.requestStatus === 'pending' ? 'Request pending' : community.isPrivate ? 'Request access' : 'Join community'}</Text>}</TouchableOpacity> : <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center' }}><View style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: '#d1fae5' }}><Text style={{ color: '#047857', fontWeight: '800' }}>{community.isOwner ? 'Owner' : 'Member'}</Text></View>{community.isMember && !community.isOwner ? <TouchableOpacity onPress={() => setActionModal({ visible: true, action: 'leave', title: 'Leave this community?', message: `You will stop seeing member-only posts from ${community.title}.` })} style={{ marginLeft: 8, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: '#fff1f2' }}><Text style={{ color: '#be123c', fontWeight: '800' }}>Leave</Text></TouchableOpacity> : null}</View>}
        </View>
        {!community.hasAccess ? <View style={{ margin: 16, padding: 20, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center' }}><Ionicons name="lock-closed" size={34} color="#64748b" /><Text style={{ marginTop: 10, color: '#0f172a', fontSize: 17, fontWeight: '900' }}>Private community</Text><Text style={{ marginTop: 6, textAlign: 'center', color: '#64748b' }}>Join requests must be approved before posts and members are visible.</Text></View> : <>
          <View style={{ flexDirection: 'row', margin: 16, padding: 4, borderRadius: 14, backgroundColor: '#e2e8f0' }}>{(['posts', 'about'] as const).map((tab) => <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11, backgroundColor: activeTab === tab ? '#fff' : 'transparent' }}><Text style={{ color: activeTab === tab ? '#047857' : '#64748b', fontWeight: '900', textTransform: 'capitalize' }}>{tab}</Text></TouchableOpacity>)}</View>
          {activeTab === 'about' ? <View style={{ marginHorizontal: 16, padding: 18, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0' }}><Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>About this community</Text><Text style={{ color: '#475569', lineHeight: 22, marginTop: 10 }}>{community.description || 'This community has not added a description yet.'}</Text><Text style={{ color: '#64748b', marginTop: 14, fontSize: 12 }}>Posting permission: {community.postingPermission}</Text></View> : <View style={{ gap: 14 }}>
            {canPost ? <TouchableOpacity onPress={() => setCreateVisible(true)} style={{ marginHorizontal: 16, padding: 15, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1fae5', flexDirection: 'row', alignItems: 'center' }}><Ionicons name="add-circle" size={25} color="#10b981" /><Text style={{ marginLeft: 10, color: '#334155', fontWeight: '800' }}>Create a community post</Text></TouchableOpacity> : null}
            {posts.length === 0 ? <View style={{ marginHorizontal: 16, padding: 28, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center' }}><Ionicons name="chatbubbles-outline" size={38} color="#10b981" /><Text style={{ marginTop: 10, fontWeight: '900', color: '#0f172a' }}>No posts yet</Text><Text style={{ marginTop: 4, color: '#64748b' }}>Start the first community conversation.</Text></View> : posts.map((post) => <View key={post.id} style={{ width: '100%', marginBottom: 12 }}><PostCardSection post={post} onCommentClick={setActivePostId} onPostDelete={(postId) => setPosts((current) => current.filter((item) => item.id !== postId))} onAuthorBlocked={(userId) => setPosts((current) => current.filter((item) => item.userId !== userId))} onPostUpdate={handlePostUpdate} /></View>)}
          </View>}
        </>}
      </ScrollView>}
      {createVisible && profile && community ? <CreatePostModal setTogglePostForm={setCreateVisible} userProfile={profile} communityId={community.id} communityName={community.title} onCreatePost={(post) => setPosts((current) => [post, ...current])} /> : null}
      {activePost && profile ? <CommentsModal post={activePost} userId={profile.uid} onClose={() => setActivePostId(null)} onPostUpdate={handlePostUpdate} /> : null}
      <CustomModal visible={Boolean(message)} title="Community" message={message ?? ''} type="info" onClose={() => setMessage(null)} />
      <CustomModal visible={actionModal.visible} title={actionModal.title} message={actionModal.message} type={actionModal.action === 'leave' ? 'warning' : 'danger'} confirmText={actionModal.action === 'leave' ? 'Leave community' : 'Submit report'} cancelText="Cancel" isLoading={joining} onConfirm={() => void handleCommunityAction()} onCancel={() => setActionModal({ visible: false, action: null, title: '', message: '' })} onClose={() => setActionModal({ visible: false, action: null, title: '', message: '' })} />
    </SafeAreaView>
  );
}
