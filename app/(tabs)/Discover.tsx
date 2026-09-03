import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService } from '@/lib/services/AuthService';
import { RelationshipService, type RelationshipSuggestion } from '@/lib/services/RelationshipService';
import { SearchService } from '@/lib/services/SearchService';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { useDiscoverResource } from '@/lib/hooks/useDiscoverResource';
import type { DiscoverEvent } from '@/lib/types/discoverResources';
import {
  SkeletonUserCard,
  SkeletonCommunityCard,
  SkeletonEventCard,
  SkeletonJobCard,
} from '@/components/home/SkeletonLoaders';
import PostLocationMap from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostLocationMap';
import { deepLinkService } from '@/lib/services/DeepLinkService';
import CustomModal from '@/components/ui/CustomModal';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';
import ShareContentSheet from '@/components/sharing/ShareContentSheet';

const authService = AuthService.getInstance();
const relationshipService = RelationshipService.getInstance();
const searchService = SearchService.getInstance();
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function DiscoverScreen() {
  const { isDark, colors } = useAppTheme();
  const router = useRouter();
  const { activeUserId } = useAppData();
  const { resource, refresh } = useDiscoverResource(activeUserId ?? '');
  const suggestedPeople = useMemo(() => resource.data?.suggestedPeople ?? [], [resource.data?.suggestedPeople]);
  const communities = useMemo(() => resource.data?.communities ?? [], [resource.data?.communities]);
  const events = useMemo(() => resource.data?.events ?? [], [resource.data?.events]);
  const jobs = useMemo(() => resource.data?.jobs ?? [], [resource.data?.jobs]);
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<RelationshipSuggestion[]>([]);
  const [isSearchingQuery, setIsSearchingQuery] = useState(false);
  const [friendSentIds, setFriendSentIds] = useState<Set<string>>(new Set());
  const [eventToShare, setEventToShare] = useState<DiscoverEvent | null>(null);
  const isLoadingPeople = suggestedPeople.length === 0 && (!resource.data || resource.data.sectionStatus.people === 'loading');
  const isLoadingCommunities = communities.length === 0 && (!resource.data || resource.data.sectionStatus.communities === 'loading');
  const isLoadingEvents = events.length === 0 && (!resource.data || resource.data.sectionStatus.events === 'loading');
  const isLoadingJobs = jobs.length === 0 && (!resource.data || resource.data.sectionStatus.jobs === 'loading');

  const handleQueryChange = (text: string) => {
    setDiscoverQuery(text);
  };

  useEffect(() => {
    const query = discoverQuery.trim();
    if (!query) {
      setUserSearchResults([]);
      setIsSearchingQuery(false);
      return;
    }
    let isCurrent = true;
    setIsSearchingQuery(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const profiles = await searchService.searchUsers(query, 20);
          if (!isCurrent) return;
          setUserSearchResults(profiles.map((profile) => ({
            id: profile.uid,
            firstName: profile.firstName,
            lastName: profile.lastName,
            userName: profile.userName,
            profileImage: profile.profilePicture ?? undefined,
            reason: 'Search result',
          })));
        } catch {
          if (isCurrent) setUserSearchResults([]);
        } finally {
          if (isCurrent) setIsSearchingQuery(false);
        }
      })();
    }, 300);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [discoverQuery]);

  const onRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const normalizedQuery = discoverQuery.trim().toLowerCase();

  const filteredPeople = useMemo(() => {
    const matchingSuggestions = !normalizedQuery ? suggestedPeople : suggestedPeople.filter((p) => {
      const name = `${p.firstName} ${p.lastName} ${p.userName}`.toLowerCase();
      return name.includes(normalizedQuery);
    });
    return [...new Map([...matchingSuggestions, ...userSearchResults].map((person) => [person.id, person])).values()];
  }, [normalizedQuery, suggestedPeople, userSearchResults]);

  const filteredCommunities = useMemo(() => {
    if (!normalizedQuery) return communities.slice(0, 6);
    return communities.filter((c) => c.title.toLowerCase().includes(normalizedQuery));
  }, [communities, normalizedQuery]);

  const filteredEvents = useMemo(() => {
    if (!normalizedQuery) return events.slice(0, 6);
    return events.filter((e) => `${e.title} ${e.location}`.toLowerCase().includes(normalizedQuery));
  }, [events, normalizedQuery]);

  const filteredJobs = useMemo(() => {
    if (!normalizedQuery) return jobs.slice(0, 6);
    return jobs.filter((j) => `${j.role} ${j.company} ${j.type}`.toLowerCase().includes(normalizedQuery));
  }, [jobs, normalizedQuery]);

  const [cancelModalUser, setCancelModalUser] = useState<RelationshipSuggestion | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const handleToggleFriend = async (person: RelationshipSuggestion) => {
    const currentUserId = authService.getCurrentUser()?.uid;
    if (!currentUserId) return;
    if (friendSentIds.has(person.id)) {
      setCancelModalUser(person);
      return;
    }
    try {
      await relationshipService.sendFriendRequest(currentUserId, person.id);
      setFriendSentIds((previous) => new Set(previous).add(person.id));
    } catch (friendError: unknown) {
      console.error('[DiscoverScreen.handleToggleFriend]', friendError);
    }
  };

  const handleConfirmCancel = async () => {
    const currentUserId = authService.getCurrentUser()?.uid;
    if (!currentUserId || !cancelModalUser) return;
    const targetUid = cancelModalUser.id;
    setCancelLoading(true);
    try {
      await relationshipService.cancelOrRemoveFriend(currentUserId, targetUid, 'pending');
      setFriendSentIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUid);
        return next;
      });
      setCancelModalUser(null);
    } catch (error: unknown) {
      console.error('[DiscoverScreen.handleConfirmCancel]', error);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* Header & Search Bar */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 10 }}>Discover</Text>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.control,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 9,
        }}>
          <Icon name="search" size={18} color={colors.icon} style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: colors.text }}
            placeholder="Search communities, events, jobs, or people..."
            placeholderTextColor={colors.mutedText}
            value={discoverQuery}
            onChangeText={handleQueryChange}
            autoCapitalize="none"
          />
          {discoverQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleQueryChange('')}>
              <Icon name="x-circle" size={18} color={colors.mutedText} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.canvas }}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={resource.status === 'refreshing'} onRefresh={onRefresh} tintColor="#10b981" />}
      >
        <View style={{ paddingVertical: 16 }}>
            {/* 1. Suggested Friends Section */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Suggested Friends</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 2 }}>People you may know & mutual connections</Text>
                </View>
              </View>

              {isLoadingPeople || (isSearchingQuery && filteredPeople.length === 0) ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  {[0, 1, 2].map((item) => <SkeletonUserCard key={`person-skeleton-${item}`} />)}
                </ScrollView>
              ) : filteredPeople.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  {filteredPeople.map((person) => {
                  const isSent = friendSentIds.has(person.id);
                  return (
                    <TouchableOpacity
                      key={person.id}
                      onPress={() => router.push({ pathname: '/profile/[username]', params: { username: person.userName || person.id } })}
                      style={{
                        width: 150,
                        padding: 14,
                        borderRadius: 20,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                        marginRight: 12,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 6,
                        elevation: 2,
                      }}
                    >
                      <UserAvatar profileImage={person.profileImage} firstName={person.firstName || person.userName} size={60} />
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 10, textAlign: 'center' }}>
                        {person.firstName} {person.lastName}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.mutedText, marginTop: 2, textAlign: 'center' }}>
                        @{person.userName}
                      </Text>
                      <TouchableOpacity
                        onPress={() => void handleToggleFriend(person)}
                        style={{
                          marginTop: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 14,
                          backgroundColor: isSent ? '#fef3c7' : '#10b981',
                          borderWidth: isSent ? 1 : 0,
                          borderColor: '#f59e0b',
                          width: '100%',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isSent ? '#b45309' : '#ffffff' }}>
                          {isSent ? 'Cancel Request' : 'Add Friend'}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
                </ScrollView>
              ) : (
                <Text style={{ paddingHorizontal: 16, color: colors.mutedText, fontSize: 13 }}>
                  {normalizedQuery ? 'No people match your search.' : 'No friend suggestions are available yet.'}
                </Text>
              )}
            </View>

            {/* 2. Featured Communities Section */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Featured Communities</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 2 }}>Join groups sharing your passions</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/communities')}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>See All</Text>
                </TouchableOpacity>
              </View>

              {isLoadingCommunities ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  {[0, 1].map((item) => <SkeletonCommunityCard key={`community-skeleton-${item}`} />)}
                </ScrollView>
              ) : filteredCommunities.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  {filteredCommunities.map((community) => (
                  <TouchableOpacity
                    key={community.id}
                    onPress={() => router.push({ pathname: '/communities/[id]', params: { id: community.id } })}
                    style={{
                      width: SCREEN_WIDTH * 0.72,
                      borderRadius: 20,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      overflow: 'hidden',
                      marginRight: 14,
                    }}
                  >
                    {community.imageUrl ? <Image source={{ uri: community.imageUrl }} style={{ width: '100%', height: 110 }} /> : <View style={{ width: '100%', height: 110, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={30} color="#10b981" /></View>}
                    <View style={{ padding: 14 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{community.title}</Text>
                      <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 4 }}>{community.membershipCount.toLocaleString()} members</Text>
                      <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#047857' }}>View community</Text>
                    </View>
                  </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ paddingHorizontal: 16, color: colors.mutedText, fontSize: 13 }}>
                  {normalizedQuery ? 'No communities match your search.' : 'No featured communities are available yet.'}
                </Text>
              )}
            </View>

            {/* 3. Featured Events Section */}
            <View style={{ marginBottom: 24, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Upcoming Events</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 2 }}>Discover what is happening near you</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/events')}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>View All</Text>
                </TouchableOpacity>
              </View>

              {isLoadingEvents ? (
                <>
                  <SkeletonEventCard />
                  <SkeletonEventCard />
                </>
              ) : filteredEvents.length > 0 ? filteredEvents.map((evt) => {
                const locationPresentation = linkPresentationService.presentLocation(evt.location);
                const locationLabel = locationPresentation.detail
                  ? `${locationPresentation.title} · ${locationPresentation.detail}`
                  : locationPresentation.title;
                return <View
                  key={evt.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 20,
                    padding: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {evt.image ? <Image source={{ uri: evt.image }} style={{ width: 64, height: 64, borderRadius: 16 }} /> : <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}><Icon name="calendar" size={24} color="#10b981" /></View>}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#10b981', textTransform: 'uppercase' }}>{evt.date}</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 }}>{evt.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Icon name="map-pin" size={12} color={colors.icon} />
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, fontSize: 12, color: colors.mutedText, marginLeft: 4 }}>{locationLabel}</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => setEventToShare(evt)} style={{ padding: 8 }}>
                      <Icon name="share-2" size={18} color={colors.icon} />
                    </TouchableOpacity>
                  </View>

                  {/* Actual Map Preview */}
                  {evt.location && evt.location !== 'Online' ? (
                    <PostLocationMap location={{ name: evt.title, address: evt.location }} />
                  ) : null}
                </View>;
              }) : (
                <Text style={{ color: colors.mutedText, fontSize: 13 }}>
                  {normalizedQuery ? 'No events match your search.' : 'No upcoming events are available yet.'}
                </Text>
              )}
            </View>

            {/* 4. Featured Jobs Section */}
            <View style={{ paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Featured Jobs</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 2 }}>Take the next step in your career</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/jobs')}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>Browse All</Text>
                </TouchableOpacity>
              </View>

              {isLoadingJobs ? (
                <>
                  <SkeletonJobCard />
                  <SkeletonJobCard />
                </>
              ) : filteredJobs.length > 0 ? filteredJobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  onPress={() => router.push('/jobs')}
                  style={{
                    flexDirection: 'row',
                    backgroundColor: colors.surface,
                    borderRadius: 20,
                    padding: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                  }}
                >
                  {job.image ? <Image source={{ uri: job.image }} style={{ width: 44, height: 44, borderRadius: 14 }} /> : <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}><Icon name="briefcase" size={20} color="#10b981" /></View>}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{job.role}</Text>
                    <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 2 }}>{job.company} · <Text style={{ color: '#10b981', fontWeight: '600' }}>{job.type}</Text></Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>{job.salary}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981', marginRight: 4 }}>Apply</Text>
                      <Icon name="arrow-right" size={12} color="#10b981" />
                    </View>
                  </View>
                </TouchableOpacity>
              )) : (
                <Text style={{ color: colors.mutedText, fontSize: 13 }}>
                  {normalizedQuery ? 'No jobs match your search.' : 'No featured jobs are available yet.'}
                </Text>
              )}
            </View>
        </View>
      </ScrollView>
      {cancelModalUser ? (
        <CustomModal
          visible={Boolean(cancelModalUser)}
          type="warning"
          title="Cancel Friend Request?"
          message={`Are you sure you want to cancel your friend request to ${cancelModalUser.firstName || cancelModalUser.userName} (@${cancelModalUser.userName})?`}
          confirmText="Cancel Request"
          cancelText="Keep Request"
          isLoading={cancelLoading}
          onConfirm={() => void handleConfirmCancel()}
          onClose={() => setCancelModalUser(null)}
        />
      ) : null}
      {eventToShare ? (
        <ShareContentSheet
          visible={Boolean(eventToShare)}
          currentUserId={activeUserId ?? ''}
          contentLabel="event"
          title={eventToShare.title}
          message={`Check out ${eventToShare.title}${eventToShare.location ? ` at ${eventToShare.location}` : ''} on Ourlime!\n\n${deepLinkService.getEventShareUrl(eventToShare.id)}`}
          url={deepLinkService.getEventShareUrl(eventToShare.id)}
          onClose={() => setEventToShare(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
