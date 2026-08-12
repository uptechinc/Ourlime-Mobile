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
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService } from '@/lib/services/AuthService';
import { CommunityService } from '@/lib/services/CommunityService';
import { EventService } from '@/lib/services/EventService';
import { JobsService } from '@/lib/job/JobsService';
import { RelationshipService, type RelationshipSuggestion } from '@/lib/services/RelationshipService';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import {
  SkeletonUserCard,
  SkeletonCommunityCard,
  SkeletonEventCard,
  SkeletonJobCard,
} from '@/components/home/SkeletonLoaders';

const authService = AuthService.getInstance();
const communityService = CommunityService.getInstance();
const eventService = EventService.getInstance();
const jobsService = JobsService.getInstance();
const relationshipService = RelationshipService.getInstance();
const SCREEN_WIDTH = Dimensions.get('window').width;

type DiscoverCommunity = {
  id: string;
  title: string;
  membershipCount: number;
  imageUrl: string | null;
};

type DiscoverEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  image: string | null;
};

type DiscoverJob = {
  id: string;
  role: string;
  company: string;
  type: string;
  salary: string;
  image: string | null;
};

export default function DiscoverScreen() {
  const router = useRouter();
  const { getDecision } = usePageAccess();
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [suggestedPeople, setSuggestedPeople] = useState<RelationshipSuggestion[]>([]);
  const [communities, setCommunities] = useState<DiscoverCommunity[]>([]);
  const [events, setEvents] = useState<DiscoverEvent[]>([]);
  const [jobs, setJobs] = useState<DiscoverJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingQuery, setIsSearchingQuery] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friendSentIds, setFriendSentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleQueryChange = (text: string) => {
    setDiscoverQuery(text);
    if (text.trim()) {
      setIsSearchingQuery(true);
      const timer = setTimeout(() => {
        setIsSearchingQuery(false);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setIsSearchingQuery(false);
    }
  };

  const loadDiscoverData = useCallback(async () => {
    setError(null);
    try {
      const [users, communityRecords, eventRecords, jobRecords] = await Promise.all([
        relationshipService.getSuggestions(8),
        communityService.fetchCommunities(6),
        getDecision('/events').canAccess ? eventService.fetchEvents() : Promise.resolve([]),
        getDecision('/jobs').canAccess ? jobsService.fetchJobs() : Promise.resolve([]),
      ]);
      setSuggestedPeople(users);
      setCommunities(communityRecords.slice(0, 6).map((item) => ({ id: item.id, title: item.title, membershipCount: item.membershipCount, imageUrl: item.imageUrl })));
      setEvents(eventRecords.slice(0, 6).map((item, index) => ({
        id: item.id || `event-${index}`,
        title: item.title,
        date: new Date(item.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        location: item.location,
        image: item.image || item.media?.find((media) => media.type === 'image')?.url || null,
      })));
      setJobs(jobRecords.slice(0, 6).map((item) => ({
        id: item.id,
        role: item.basic_info.title,
        company: item.creator?.name || 'Ourlime member',
        type: item.basic_info.type,
        salary: `$${item.basic_info.priceRange.from.toLocaleString()} - $${item.basic_info.priceRange.to.toLocaleString()}`,
        image: item.creator?.profileImage || null,
      })));
    } catch (loadError: unknown) {
      console.error('[DiscoverScreen.loadDiscoverData]', loadError);
      setError('Discover could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [getDecision]);

  useEffect(() => {
    void loadDiscoverData();
  }, [loadDiscoverData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadDiscoverData();
  }, [loadDiscoverData]);

  const normalizedQuery = discoverQuery.trim().toLowerCase();

  const filteredPeople = useMemo(() => {
    if (!normalizedQuery) return suggestedPeople;
    return suggestedPeople.filter((p) => {
      const name = `${p.firstName} ${p.lastName} ${p.userName}`.toLowerCase();
      return name.includes(normalizedQuery);
    });
  }, [suggestedPeople, normalizedQuery]);

  const filteredCommunities = useMemo(() => {
    if (!normalizedQuery) return communities;
    return communities.filter((c) => c.title.toLowerCase().includes(normalizedQuery));
  }, [communities, normalizedQuery]);

  const filteredEvents = useMemo(() => {
    if (!normalizedQuery) return events;
    return events.filter((e) => `${e.title} ${e.location}`.toLowerCase().includes(normalizedQuery));
  }, [events, normalizedQuery]);

  const filteredJobs = useMemo(() => {
    if (!normalizedQuery) return jobs;
    return jobs.filter((j) => `${j.role} ${j.company} ${j.type}`.toLowerCase().includes(normalizedQuery));
  }, [jobs, normalizedQuery]);

  const handleToggleFriend = async (uid: string) => {
    const currentUserId = authService.getCurrentUser()?.uid;
    if (!currentUserId || friendSentIds.has(uid)) return;
    try {
      await relationshipService.sendFriendRequest(currentUserId, uid);
      setFriendSentIds((previous) => new Set(previous).add(uid));
    } catch (friendError: unknown) {
      console.error('[DiscoverScreen.handleToggleFriend]', friendError);
    }
  };

  const handleShareEvent = async (event: DiscoverEvent) => {
    try {
      await Share.share({ message: `Check out ${event.title} at ${event.location} on Ourlime!` });
    } catch {
      // Ignored
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header & Search Bar */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 10 }}>Discover</Text>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f1f5f9',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 9,
        }}>
          <Icon name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: '#0f172a' }}
            placeholder="Search communities, events, jobs, or people..."
            placeholderTextColor="#94a3b8"
            value={discoverQuery}
            onChangeText={handleQueryChange}
            autoCapitalize="none"
          />
          {discoverQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleQueryChange('')}>
              <Icon name="x-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#f8fafc' }}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
      >
        {isLoading || isSearchingQuery ? (
          <View style={{ paddingVertical: 16 }}>
            {/* Suggested Friends Skeleton */}
            <View style={{ marginBottom: 24, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 12 }}>Suggested Friends</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <SkeletonUserCard />
                <SkeletonUserCard />
                <SkeletonUserCard />
              </ScrollView>
            </View>

            {/* Featured Communities Skeleton */}
            <View style={{ marginBottom: 24, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 12 }}>Featured Communities</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <SkeletonCommunityCard />
                <SkeletonCommunityCard />
              </ScrollView>
            </View>

            {/* Upcoming Events Skeleton */}
            <View style={{ marginBottom: 24, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 12 }}>Upcoming Events</Text>
              <SkeletonEventCard />
              <SkeletonEventCard />
            </View>

            {/* Featured Jobs Skeleton */}
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 12 }}>Featured Jobs</Text>
              <SkeletonJobCard />
              <SkeletonJobCard />
            </View>
          </View>
        ) : error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Icon name="wifi-off" size={36} color="#64748b" />
            <Text style={{ color: '#475569', textAlign: 'center', lineHeight: 21, marginTop: 12 }}>{error}</Text>
            <TouchableOpacity onPress={() => void loadDiscoverData()} style={{ backgroundColor: '#10b981', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, marginTop: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingVertical: 16 }}>
            {/* 1. Suggested Friends Section */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Suggested Friends</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>People you may know & mutual connections</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {filteredPeople.map((person) => {
                  const isSent = friendSentIds.has(person.id);
                  return (
                    <TouchableOpacity
                      key={person.id}
                      onPress={() => router.push({ pathname: '/profile/[username]', params: { username: person.userName } })}
                      style={{
                        width: 150,
                        padding: 14,
                        borderRadius: 20,
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
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
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: '#1e293b', marginTop: 10, textAlign: 'center' }}>
                        {person.firstName} {person.lastName}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: '#64748b', marginTop: 2, textAlign: 'center' }}>
                        @{person.userName}
                      </Text>
                      <TouchableOpacity
                        onPress={() => void handleToggleFriend(person.id)}
                        style={{
                          marginTop: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 14,
                          backgroundColor: isSent ? '#e2e8f0' : '#10b981',
                          width: '100%',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isSent ? '#475569' : '#ffffff' }}>
                          {isSent ? 'Pending' : 'Add Friend'}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 2. Featured Communities Section */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Featured Communities</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Join groups sharing your passions</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/communities')}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>See All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {filteredCommunities.map((community) => (
                  <TouchableOpacity
                    key={community.id}
                    onPress={() => router.push({ pathname: '/communities/[id]', params: { id: community.id } })}
                    style={{
                      width: SCREEN_WIDTH * 0.72,
                      borderRadius: 20,
                      backgroundColor: '#ffffff',
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      overflow: 'hidden',
                      marginRight: 14,
                    }}
                  >
                    {community.imageUrl ? <Image source={{ uri: community.imageUrl }} style={{ width: '100%', height: 110 }} /> : <View style={{ width: '100%', height: 110, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={30} color="#10b981" /></View>}
                    <View style={{ padding: 14 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#1e293b' }}>{community.title}</Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{community.membershipCount.toLocaleString()} members</Text>
                      <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#047857' }}>View community</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* 3. Featured Events Section */}
            <View style={{ marginBottom: 24, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Upcoming Events</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Discover what is happening near you</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/events')}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>View All</Text>
                </TouchableOpacity>
              </View>

              {filteredEvents.map((evt) => (
                <View
                  key={evt.id}
                  style={{
                    flexDirection: 'row',
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    padding: 12,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    alignItems: 'center',
                  }}
                >
                  {evt.image ? <Image source={{ uri: evt.image }} style={{ width: 80, height: 80, borderRadius: 16 }} /> : <View style={{ width: 80, height: 80, borderRadius: 16, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}><Icon name="calendar" size={24} color="#10b981" /></View>}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#10b981', textTransform: 'uppercase' }}>{evt.date}</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b', marginTop: 2 }}>{evt.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Icon name="map-pin" size={12} color="#64748b" />
                      <Text style={{ fontSize: 12, color: '#64748b', marginLeft: 4 }}>{evt.location}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => void handleShareEvent(evt)} style={{ padding: 8 }}>
                    <Icon name="share-2" size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* 4. Featured Jobs Section */}
            <View style={{ paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Featured Jobs</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Take the next step in your career</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/jobs')}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>Browse All</Text>
                </TouchableOpacity>
              </View>

              {filteredJobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  onPress={() => router.push('/jobs')}
                  style={{
                    flexDirection: 'row',
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    padding: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    alignItems: 'center',
                  }}
                >
                  {job.image ? <Image source={{ uri: job.image }} style={{ width: 44, height: 44, borderRadius: 14 }} /> : <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}><Icon name="briefcase" size={20} color="#10b981" /></View>}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b' }}>{job.role}</Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{job.company} · <Text style={{ color: '#10b981', fontWeight: '600' }}>{job.type}</Text></Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#1e293b' }}>{job.salary}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981', marginRight: 4 }}>Apply</Text>
                      <Icon name="arrow-right" size={12} color="#10b981" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
