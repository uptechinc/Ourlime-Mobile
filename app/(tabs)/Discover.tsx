import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { SearchService } from '@/lib/services/SearchService';
import type { UserProfile } from '@/lib/services/AuthService';
import {
  SkeletonUserCard,
  SkeletonCommunityCard,
  SkeletonEventCard,
  SkeletonJobCard,
} from '@/components/home/SkeletonLoaders';

const searchService = SearchService.getInstance();
const SCREEN_WIDTH = Dimensions.get('window').width;

type DiscoverCommunity = {
  id: string;
  title: string;
  membershipCount: number;
  imageUrl: string;
};

type DiscoverEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  image: string;
};

type DiscoverJob = {
  id: string;
  role: string;
  company: string;
  type: string;
  salary: string;
  image: string;
};

const DISCOVER_COMMUNITIES: DiscoverCommunity[] = [
  { id: '1', title: 'Caribbean Tech Innovators', membershipCount: 1420, imageUrl: 'https://picsum.photos/400/200?random=1' },
  { id: '2', title: 'Trini Foodies & Chefs', membershipCount: 890, imageUrl: 'https://picsum.photos/400/200?random=2' },
  { id: '3', title: 'Ourlime Entrepreneurs', membershipCount: 2300, imageUrl: 'https://picsum.photos/400/200?random=3' },
];

const DISCOVER_EVENTS: DiscoverEvent[] = [
  { id: '1', title: 'Upcoming community events', date: 'AUG 12', location: 'Ourlime Events Center', image: 'https://picsum.photos/400/200?random=5' },
  { id: '2', title: 'Local Tech & Design Meetup', date: 'AUG 18', location: 'Port of Spain, Trinidad', image: 'https://picsum.photos/400/200?random=6' },
];

const DISCOVER_JOBS: DiscoverJob[] = [
  { id: '1', role: 'Senior Mobile Developer', company: 'Ourlime Tech', type: 'Full-time', salary: '$5,000 / mo', image: 'https://picsum.photos/100/100?random=8' },
  { id: '2', role: 'UI/UX Product Designer', company: 'Creative Caribbean', type: 'Remote', salary: '$4,200 / mo', image: 'https://picsum.photos/100/100?random=9' },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [suggestedPeople, setSuggestedPeople] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingQuery, setIsSearchingQuery] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friendSentIds, setFriendSentIds] = useState<Set<string>>(new Set());

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
    try {
      const users = await searchService.searchUsers('a', 8);
      setSuggestedPeople(users);
    } catch (error) {
      console.error('[DiscoverScreen.loadDiscoverData]', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    if (!normalizedQuery) return DISCOVER_COMMUNITIES;
    return DISCOVER_COMMUNITIES.filter((c) => c.title.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery]);

  const filteredEvents = useMemo(() => {
    if (!normalizedQuery) return DISCOVER_EVENTS;
    return DISCOVER_EVENTS.filter((e) => `${e.title} ${e.location}`.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery]);

  const filteredJobs = useMemo(() => {
    if (!normalizedQuery) return DISCOVER_JOBS;
    return DISCOVER_JOBS.filter((j) => `${j.role} ${j.company} ${j.type}`.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery]);

  const handleToggleFriend = (uid: string) => {
    setFriendSentIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
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
                  const isSent = friendSentIds.has(person.uid);
                  return (
                    <TouchableOpacity
                      key={person.uid}
                      onPress={() => router.push(`/profile/${person.userName}` as any)}
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
                      <UserAvatar profileImage={person.profilePicture} firstName={person.firstName || person.userName} size={60} />
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: '#1e293b', marginTop: 10, textAlign: 'center' }}>
                        {person.firstName} {person.lastName}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: '#64748b', marginTop: 2, textAlign: 'center' }}>
                        @{person.userName}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleToggleFriend(person.uid)}
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
                <TouchableOpacity onPress={() => router.push('/communities/page' as any)}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>See All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {filteredCommunities.map((community) => (
                  <TouchableOpacity
                    key={community.id}
                    onPress={() => router.push('/communities/page' as any)}
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
                    <Image source={{ uri: community.imageUrl }} style={{ width: '100%', height: 110 }} />
                    <View style={{ padding: 14 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#1e293b' }}>{community.title}</Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{community.membershipCount.toLocaleString()} members</Text>
                      <TouchableOpacity style={{ marginTop: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#047857' }}>Join Community</Text>
                      </TouchableOpacity>
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
                <TouchableOpacity onPress={() => router.push('/events/page' as any)}>
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
                  <Image source={{ uri: evt.image }} style={{ width: 80, height: 80, borderRadius: 16 }} />
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
                <TouchableOpacity onPress={() => router.push('/jobs/page' as any)}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>Browse All</Text>
                </TouchableOpacity>
              </View>

              {filteredJobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  onPress={() => router.push('/jobs/page' as any)}
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
                  <Image source={{ uri: job.image }} style={{ width: 44, height: 44, borderRadius: 14 }} />
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
