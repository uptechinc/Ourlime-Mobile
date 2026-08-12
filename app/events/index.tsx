import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import type { Event } from '@/types/eventTypes';
import PopularEvents from '@/components/events/PopularEvents';
import EventsFilterSection from '@/components/events/FilterSection';
import EventsContentSection from '@/components/events/ContentSection';
import { Svg, Path } from 'react-native-svg';
import PageHeader from '@/components/ui/PageHeader';
import {useRouter} from 'expo-router';

// Firebase imports are commented out until backend is ready
// import { auth, db } from '@/lib/firebaseConfig';
// import { onSnapshot, collection, query, orderBy, getDocs, where, deleteDoc, setDoc, updateDoc, increment, addDoc } from 'firebase/firestore';

// Dummy event data
const dummyEvents: Event[] = [
  {
    id: '1',
    title: 'React Native Workshop',
    summary: 'Hands-on RN training',
    description: 'Learn React Native basics in this interactive workshop.',
    startDate: '2025-05-10',
    endDate: '2025-05-10',
    image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',

    location: 'Online',
    userId: 'user1',
    likeCount: 30,
    recurrence: 'none',
    category: 'Educational',
    tags: ['Workshop', 'React'],
    media: [{
      type: 'image',
      url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',

    }],
  },
  {
    id: '2',
    title: 'Music Festival',
    summary: 'Live bands & DJs',
    description: 'Enjoy live performances from top artists.',
    startDate: '2025-06-01',
    endDate: '2025-06-03',
    image: 'https://images.unsplash.com/photo-1504805572947-34fad45aed93?auto=format&fit=crop&w=800&q=80',
    location: 'City Park',
    userId: 'user2',
    likeCount: 50,
    recurrence: 'none',
    category: 'Music',
    tags: ['Festival', 'Live'],
    media: [{
      type: 'image',
      url: 'https://images.unsplash.com/photo-1504805572947-34fad45aed93?auto=format&fit=crop&w=800&q=80',
    }],
  },
  {
    id: '3',
    title: 'Business Networking',
    summary: 'Connect with professionals',
    description: 'Expand your network and meet peers.',
    startDate: '2025-05-20',
    endDate: '2025-05-20',
    image: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=400&q=80',
    location: 'Downtown Hall',
    userId: 'user3',
    likeCount: 20,
    recurrence: 'none',
    category: 'Business',
    tags: ['Networking'],
    media: [{
      type: 'image',
      url: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=400&q=80'
    }],
  },
  {
    id: '4',
    title: 'Tech Conference',
    summary: 'Latest in tech',
    description: 'Keynotes and workshops on emerging tech.',
    startDate: '2025-07-15',
    endDate: '2025-07-17',
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=400&q=80',
    location: 'Convention Center',
    userId: 'user4',
    likeCount: 40,
    recurrence: 'none',
    category: 'Tech',
    tags: ['Conference', 'Innovation'],
    media: [{
      type: 'image',
      url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=400&q=80'
    }],
  },
  {
    id: '5',
    title: 'Charity Fun Run',
    summary: 'Run for a cause',
    description: 'Join the 5K fun run to support local charities.',
    startDate: '2025-06-15',
    endDate: '2025-06-15',
    image: 'https://images.unsplash.com/photo-1550345332-09e3ac987658?auto=format&fit=crop&w=800&q=80',
    location: 'Riverside Park',
    userId: 'user5',
    likeCount: 18,
    recurrence: 'none',
    category: 'Sports',
    tags: ['Charity', 'Run', 'Fitness'],
    media: [{
      type: 'image',
      url: 'https://images.unsplash.com/photo-1550345332-09e3ac987658?auto=format&fit=crop&w=800&q=80',
    }],
  },
  {
    id: '6',
    title: 'Food Truck Fiesta',
    summary: 'Gourmet eats all day',
    description: 'Taste the best local street food and delicacies.',
    startDate: '2025-08-05',
    endDate: '2025-08-05',
    image: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=400&q=80',
    location: 'Town Square',
    userId: 'user6',
    likeCount: 22,
    recurrence: 'none',
    category: 'Food',
    tags: ['Food', 'Festival', 'Street Food'],
    media: [{
      type: 'image',
      url: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=400&q=80'
    }],
  },
  {
    id: '7',
    title: 'Yoga in the Park',
    summary: 'Relax, breathe, connect',
    description: 'Morning yoga session open to all levels.',
    startDate: '2025-07-01',
    endDate: '2025-07-01',
    image: 'https://images.unsplash.com/photo-1612831813064-d30f0952a820?auto=format&fit=crop&w=800&q=80',
    location: 'Botanical Gardens',
    userId: 'user7',
    likeCount: 16,
    recurrence: 'weekly',
    category: 'Wellness',
    tags: ['Yoga', 'Wellness', 'Fitness'],
    media: [{
      type: 'image',
      url: 'https://images.unsplash.com/photo-1612831813064-d30f0952a820?auto=format&fit=crop&w=800&q=80',
    }],
  },
];


export default function EventsPage() {
  const [events] = useState<Event[]>(dummyEvents);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Events');
  const [selectedTag] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateModalOpen] = useState(false);
  const router = useRouter();
  //console.log('📦 EventsPage render, isCreateModalOpen =', isCreateModalOpen)

  const [likedEvents, setLikedEvents] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(
    () => dummyEvents.reduce((acc, e) => ({ ...acc, [e.id!]: e.likeCount }), {})
  );
  const [registeredEvents, setRegisteredEvents] = useState<Record<string, boolean>>({});
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>(
    () => dummyEvents.reduce((acc, e) => ({ ...acc, [e.id!]: 0 }), {})
  );

  // Compute category counts
  const categories = useMemo(() => {
    return events.reduce<Record<string, number>>((acc, ev) => {
      const cat = ev.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
  }, [events]);

  // Compute popular tags
  // const tagCounts = useMemo(() => {
  //   return events.reduce<Record<string, number>>((acc, ev) => {
  //     ev.tags?.forEach(tag => {
  //       acc[tag] = (acc[tag] || 0) + 1;
  //     });
  //     return acc;
  //   }, {});
  // }, [events]);

  // const popularTags = useMemo(() => {
  //   return Object.entries(tagCounts)
  //     .sort(([,a],[,b]) => b - a)
  //     .slice(0, 5);
  // }, [tagCounts]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const matchesSearch = ev.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'All Events' || ev.category === selectedCategory;
      const matchesTag = !selectedTag || ev.tags?.includes(selectedTag);
      return matchesSearch && matchesCat && matchesTag;
    });
  }, [events, searchQuery, selectedCategory, selectedTag]);

   // **New**: pick top 4 by current likeCounts
   const popularEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => (likeCounts[b.id!] || 0) - (likeCounts[a.id!] || 0))
      .slice(0, 4);
  }, [events, likeCounts]);

  // Like handler (in-memory)
  const handleLike = (eventId: string) => {
    setLikedEvents(prev => {
      const liked = !!prev[eventId];
      const updated = { ...prev, [eventId]: !liked };
      setLikeCounts(counts => ({
        ...counts,
        [eventId]: (counts[eventId] || 0) + (liked ? -1 : 1)
      }));
      return updated;
    });
  };

  // RSVP handler (in-memory)
  const handleRSVP = (eventId: string) => {
    setRegisteredEvents(prev => {
      const reg = !!prev[eventId];
      const updated = { ...prev, [eventId]: !reg };
      setRegistrationCounts(counts => ({
        ...counts,
        [eventId]: (counts[eventId] || 0) + (reg ? -1 : 1)
      }));
      return updated;
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <PageHeader
       title="Events"
       onBackPress={() => router.back()}
       />

      <ScrollView
        style={{ flex: 1 }}
        scrollEnabled={!isFilterOpen && !isCreateModalOpen}
        keyboardShouldPersistTaps="handled"
      >
        <PopularEvents events={popularEvents} />

        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          marginBottom: 16,
        }}>
          {/* Actions */}
          <TouchableOpacity
            onPress={() => setIsFilterOpen(true)}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              paddingHorizontal: 16,
              backgroundColor: '#4b5563',
              borderRadius: 10,
              marginRight: 12,
            }}
          >
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="#fff">
          <Path
            d="M4 6h16M4 12h16m-7 6h7"
            stroke="#fff"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: '600',
            marginLeft: 6,
          }}
        >Filters</Text>
          </TouchableOpacity>

          {/* Categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16 }}
            style={{ flex: 1 }} 
          >
            {/* “All Events” chip */}
          <TouchableOpacity
            onPress={() => setSelectedCategory('All Events')}
            style={{
              marginRight: 8,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor:
                selectedCategory === 'All Events' ? '#01eb53' : '#E5E7EB',
            }}
          >
              <Text
        style={{
          color: selectedCategory === 'All Events' ? '#000' : '#374151',
        }}
      >
        All Events ({events.length})
      </Text>
      </TouchableOpacity>

      {/* Dynamic chips */}
      {Object.entries(categories).map(([cat, count]) => (
        <TouchableOpacity
          key={cat}
          onPress={() => setSelectedCategory(cat)}
          style={{
            marginRight: 8,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 16,
            backgroundColor:
              selectedCategory === cat ? '#01eb53' : '#E5E7EB',
          }}
        >
          <Text
            style={{
              color: selectedCategory === cat ? '#000' : '#374151',
            }}
          >
            {cat} ({count})
          </Text>
        </TouchableOpacity>
      ))}
          </ScrollView>
        </View>

        <EventsContentSection
          events={filteredEvents}
          onSearch={setSearchQuery}
          handleRSVP={handleRSVP}
          likedEvents={likedEvents}
          likeCounts={likeCounts}
          registeredEvents={registeredEvents}
          registrationCounts={registrationCounts}
          onLike={handleLike}
          currentUserId="user1"
        />
      </ScrollView>

      {/* FILTER DRAWER */}
      <EventsFilterSection
        isOpen={isFilterOpen}
        setIsOpen={setIsFilterOpen}
        //onCreateEvent={() => setIsCreateModalOpen(true)}
      />

       {/* Create Event Modal */}
       {/* {isCreateModalOpen && (
        <CreateEventModal
          visible={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )} */}
    </View>
  );
}
