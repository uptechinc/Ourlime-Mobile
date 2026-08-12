import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  Search,
  Heart,
  Users,
  MessageCircle,
  Plus,
} from 'lucide-react-native';
import type { Event } from '@/types/eventTypes';
import EventDetailModal from '@/components/events/eventDetailModal/EventDetailModal';
import EventCommentModal from '@/components/events/EventCommentModal';
import CreateEventModal from '@/components/events/createEventModal/CreateEventModal';

const { width } = Dimensions.get('window');
const ITEM_MARGIN = 16;
const ITEM_WIDTH = width - ITEM_MARGIN * 2;
const IMAGE_HEIGHT = ITEM_WIDTH * 0.6;

type EventsContentProps = {
  events: Event[];
  onSearch: (query: string) => void;
  handleRSVP: (eventId: string) => void;
  likedEvents: { [key: string]: boolean };
  likeCounts: { [key: string]: number };
  registeredEvents: { [key: string]: boolean };
  registrationCounts: { [key: string]: number };
  onLike: (eventId: string) => void;
  currentUserId?: string;
};

export default function EventsContentSection({
  events,
  onSearch,
  handleRSVP,
  likedEvents,
  likeCounts,
  registeredEvents,
  registrationCounts,
  onLike,
  currentUserId,
}: EventsContentProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [commentEventId, setCommentEventId] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  //const [filterOpen, setFilterOpen] = useState(false);

  const handleViewDetails = (event:Event) => {
    setSelectedEvent(event);
  }

  return (
    <View style={{ flex: 1, paddingTop: ITEM_MARGIN }}>
      {/* ───────── New-event Button ───────── */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setCreateVisible(true)}
        style={{
          marginHorizontal: ITEM_MARGIN,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#01eb53',
          borderRadius: 10,
          paddingVertical: 10,
        }}
      >
        <Plus size={20} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 6 }}>
          Create New Event
        </Text>
      </TouchableOpacity>

      {/* ───────── Search ───────── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: ITEM_MARGIN,
          marginBottom: ITEM_MARGIN,
        }}
      >
        <Search size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="Search events..."
          onChangeText={onSearch}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        />
      </View>

      {/* ───────── Events list ───────── */}
      <FlashList
        data={events}
        keyExtractor={item => item.id!}
        contentContainerStyle={{ paddingBottom: ITEM_MARGIN }}
        nestedScrollEnabled
        renderItem={({ item: evt }) => (
          <TouchableOpacity
            onPress={() => handleViewDetails(evt)}
            activeOpacity={0.8}
            style={{
              width: ITEM_WIDTH,
              marginHorizontal: ITEM_MARGIN,
              marginBottom: ITEM_MARGIN,
              backgroundColor: '#fff',
              borderRadius: 12,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            {/* Date ribbon */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                backgroundColor: '#019134',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderBottomLeftRadius: 12,
                zIndex: 1,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12 }}>
                {new Date(evt.startDate).toLocaleDateString()}
              </Text>
            </View>

            {/* Image */}
            {evt.image ? (
              <Image
                source={{ uri: evt.image }}
                style={{ width: '100%', height: IMAGE_HEIGHT }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: '100%',
                  height: IMAGE_HEIGHT,
                  backgroundColor: '#E5E7EB',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#6B7280' }}>No Image</Text>
              </View>
            )}

            {/* Info */}
            <View style={{ padding: 12 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}
              >
                {evt.title}
              </Text>
              <Text
                numberOfLines={2}
                style={{ fontSize: 14, color: '#4B5563', marginTop: 4 }}
              >
                {evt.summary}
              </Text>

              {/* Actions */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => onLike(evt.id!)}
                    style={{ marginRight: 12 }}
                  >
                    <Heart
                      size={20}
                      color={likedEvents[evt.id!] ? '#10B981' : '#6B7280'}
                      fill={likedEvents[evt.id!] ? 'currentColor' : 'none'}
                    />
                  </TouchableOpacity>
                  <Text
                    style={{ fontSize: 16, color: '#374151', marginRight: 16 }}
                  >
                    {likeCounts[evt.id!] || 0}
                  </Text>
                  <Users size={20} color="#6B7280" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 16, color: '#374151' }}>
                    {registrationCounts[evt.id!]}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setCommentEventId(evt.id!)}
                    style={{ marginLeft: 12 }}
                  >
                    <MessageCircle size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Registration Status Indicator */}
                {evt.userId !== currentUserId && (
                  <View 
                  style={{
                    backgroundColor: evt.userId === currentUserId 
                      ? '#3B82F6'  // Blue for events created by current user
                      : registeredEvents[evt.id!] 
                        ? '#10B981'  // Green for registered events
                        : '#6B7280', // Gray for not registered
                    borderRadius: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>
                    {evt.userId === currentUserId 
                      ? 'Your Event' 
                      : registeredEvents[evt.id!] 
                        ? 'Registered' 
                        : 'Not Registered'
                    }
                  </Text>
                </View>
                )}

                {/* View Details Button */}
                {/* <TouchableOpacity
                    onPress={() => handleViewDetails(evt)}
                    style={{
                      backgroundColor: '#3B82F6',
                      borderRadius: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      marginRight: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Eye size={16} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500' }}>
                      Details
                    </Text>
                  </TouchableOpacity> */}



                {/* RSVP Button - only show if not the event creator */}
                {/* {evt.userId !== currentUserId && (
                  <TouchableOpacity
                    onPress={() => handleRSVP(evt.id!)}
                    style={{
                      backgroundColor: registeredEvents[evt.id!]
                        ? '#EF4444'
                        : '#01eb53',
                      borderRadius: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 16 }}>
                      {registeredEvents[evt.id!]
                        ? 'Unregister'
                        : 'Register'}
                    </Text>
                  </TouchableOpacity>
                )} */}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* ───────── Detail modal ───────── */}
      {selectedEvent && (
        <EventDetailModal
          visible={true}
          selectedEvent={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRSVP={() => {
            handleRSVP(selectedEvent.id!);
            //setSelectedEvent(null);
          }}
          isRegistered={registeredEvents[selectedEvent.id!] || false}
          onLike={() => onLike(selectedEvent.id!)}
          isLiked={likedEvents[selectedEvent.id!] || false}
          likeCount={likeCounts[selectedEvent.id!] || 0}
          registrationCount={registrationCounts[selectedEvent.id!] || 0}
          currentUserId={currentUserId}
        />
      )}
      

      {/*───────── Comment modal ───────── */}
      {commentEventId && (
        <EventCommentModal
          eventId={commentEventId}
          onClose={() => setCommentEventId(null)}
        />
      )}

      {/* ───────── Create Event modal ───────── */}
      {createVisible && (
        <CreateEventModal
          visible={true}
          onClose={() => setCreateVisible(false)}
        />
      )}
    </View>
  );
}
