import React from 'react';
import {
  Modal,
  View,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Text,
  Image,
  Dimensions,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

function EventMediaVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
  });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} allowsFullscreen />;
}
import {
  X,
  Users,
  Clock,
  MapPin,
  Heart,
  Calendar,
  User,
} from 'lucide-react-native';
import type { Event } from '@/types/eventTypes';

interface Comment {
  id: string;
  profileImage: string;
  userDate?: {
    firstName: string;
    lastname: string;
    username: string;
  };
  comment: string;
  timestamp: Date;
  replies: Comment[]
}


interface Props {
  visible: boolean;
  selectedEvent: Event;           // ← renamed
  onClose: () => void;
  onRSVP: () => void;
  isRegistered: boolean;
  onLike: () => void;
  isLiked: boolean;
  likeCount: number;
  registrationCount: number;
  currentUserId?: string;
}

// ─── Component ────────────────────────────
export default function EventDetailModal({
  visible,
  selectedEvent,
  onClose,
  onRSVP,
  isRegistered,
  onLike,
  isLiked,
  likeCount,
  registrationCount,
  currentUserId,
}: Props) {
  const media = selectedEvent.media?.[0];
  const { width, height } = Dimensions.get('window');
  const modalWidth = Math.min(width, 350);
  const maxHeight = height * 0.9;

  return (
    <Modal visible={visible} transparent animationType="fade">
      {/* Overlay */}
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        {/* Modal Content */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: modalWidth,
            maxHeight: maxHeight,
            backgroundColor: '#fff',
            borderRadius: 16,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          {/* Header with close button */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
              Event Details
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={8}
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 20,
                padding: 6,
              }}
            >
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Event Image */}
            <View style={{ height: 200, width: '100%' }}>
              {media?.type === 'image' && (
                <Image
                  source={{ uri: media.url }}
                  resizeMode="cover"
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                />
              )}
              {media?.type === 'video' && (
                <EventMediaVideo url={media.url} />
              )}
              {!media && (
                <View
                  style={{
                    flex: 1,
                    backgroundColor: '#F3F4F6',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Calendar size={48} color="#9CA3AF" />
                  <Text style={{ color: '#6B7280', marginTop: 8, fontSize: 16 }}>
                    No Image
                  </Text>
                </View>
              )}
            </View>

            {/* Event Content */}
            <View style={{ padding: 20 }}>
              {/* Title */}
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: 8,
                }}
              >
                {selectedEvent.title}
              </Text>

              {/* Date and Time */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 12,
                  backgroundColor: '#F8FAFC',
                  padding: 12,
                  borderRadius: 8,
                }}
              >
                <Clock size={18} color="#3B82F6" />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
                    Event Date
                  </Text>
                  <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>
                    {new Date(selectedEvent.startDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    {selectedEvent.time && ` at ${selectedEvent.time}`}
                  </Text>
                  {selectedEvent.endDate !== selectedEvent.startDate && (
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      Ends: {new Date(selectedEvent.endDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>

              {/* Location */}
              {selectedEvent.location && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                    backgroundColor: '#F8FAFC',
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <MapPin size={18} color="#10B981" />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
                      Location
                    </Text>
                    <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>
                      {selectedEvent.location}
                    </Text>
                  </View>
                </View>
              )}

              {/* Description */}
              {selectedEvent.summary && (
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: 8,
                    }}
                  >
                    About this event
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 22,
                      color: '#4B5563',
                    }}
                  >
                    {selectedEvent.summary}
                  </Text>
                </View>
              )}

              {/* Event Stats */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  marginBottom: 20,
                  backgroundColor: '#F8FAFC',
                  padding: 16,
                  borderRadius: 12,
                }}
              >
                <TouchableOpacity
                  onPress={onLike}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: isLiked ? '#FEF2F2' : 'transparent',
                  }}
                >
                  <Heart
                    size={20}
                    color={isLiked ? '#EF4444' : '#6B7280'}
                    fill={isLiked ? '#EF4444' : 'none'}
                  />
                  <Text
                    style={{
                      marginLeft: 6,
                      fontSize: 14,
                      fontWeight: '600',
                      color: isLiked ? '#EF4444' : '#6B7280',
                    }}
                  >
                    {likeCount}
                  </Text>
                </TouchableOpacity>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 8,
                  }}
                >
                  <Users size={20} color="#6B7280" />
                  <Text
                    style={{
                      marginLeft: 6,
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#6B7280',
                    }}
                  >
                    {registrationCount} registered
                  </Text>
                </View>
              </View>

              {/* Register/Unregister Button */}
              {currentUserId !== selectedEvent.userId && (
                <TouchableOpacity
                  onPress={onRSVP}
                  //disabled={isRegistered}
                  style={{
                    backgroundColor: isRegistered ? '#EF4444' : '#3B82F6',
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    shadowColor: isRegistered ? '#EF4444' : '#3B82F6',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: '600',
                    }}
                  >
                    {isRegistered ? 'Unregister' : 'Register for Event'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Event Creator Info */}
              {selectedEvent.userId === currentUserId && (
                <View
                  style={{
                    backgroundColor: '#F0FDF4',
                    padding: 12,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 12,
                  }}
                >
                  <User size={16} color="#10B981" />
                  <Text style={{ marginLeft: 8, fontSize: 14, color: '#065F46' }}>
                    You created this event
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
