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
import { ResizeMode, Video } from 'expo-av'; // expo install expo-av
import {
  X,
  Users,
  Clock,
  MapPin,
  Heart,
} from 'lucide-react-native';
import type { Event } from '@/types/eventTypes';


// ─── Types ─────────────────────────────────
//type Media = { url: string; type: 'image' | 'video' };
// export interface Event {
//   id: string;
//   title: string;
//   summary?: string;
//   startDate: string;
//   endDate: string;
//   location?: string;
//   userId?: string;
//   media?: Media[];
// }

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
  const { width } = Dimensions.get('window');

  return (
    <Modal visible={visible} transparent animationType="slide">
      {/* Overlay */}
      <Pressable
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
        }}
      />

      {/* Bottom-sheet card */}
      <View
        style={{
          marginTop: 'auto',
          backgroundColor: '#fff',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '85%',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {/* Close */}
        <TouchableOpacity
          onPress={onClose}
          hitSlop={12}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 10,
            backgroundColor: 'rgba(0,0,0,0.05)',
            borderRadius: 16,
            padding: 4,
          }}
        >
          <X size={20} color="#4b5563" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          {/* Media header */}
          <View style={{ width, height: 200, alignSelf: 'center' }}>
            {/* Green diagonal
            <View
              style={{
                position: 'absolute',
                top: -40,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#16a34a',
                transform: [{ skewY: '-10deg' }],
              }}
            /> */}
            {media?.type === 'image' && (
              <Image
                source={{ uri: media.url }}
                resizeMode="cover"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                }}
              />
            )}
            {media?.type === 'video' && (
              <Video
                source={{ uri: media.url }}
                resizeMode={ResizeMode.COVER}
                useNativeControls
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                }}
              />
            )}
          </View>

          {/* Title */}
          <Text style={{ marginTop: 16, fontSize: 20, fontWeight: '700', color: '#111827' }}>
            {selectedEvent.title}
          </Text>

          {/* Dates */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Clock size={16} color="#6b7280" />
            <Text style={{ marginLeft: 6, fontSize: 14, color: '#6b7280' }}>
              {new Date(selectedEvent.startDate).toLocaleDateString()} –{' '}
              {new Date(selectedEvent.endDate).toLocaleDateString()}
            </Text>
          </View>

          {/* Location */}
          {selectedEvent.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <MapPin size={16} color="#6b7280" />
              <Text style={{ marginLeft: 6, fontSize: 14, color: '#6b7280' }}>
                {selectedEvent.location}
              </Text>
            </View>
          )}

          {/* Summary */}
          {selectedEvent.summary && (
            <Text
              style={{
                marginTop: 10,
                fontSize: 14,
                lineHeight: 20,
                color: '#374151',
              }}
            >
              {selectedEvent.summary}
            </Text>
          )}

          {/* Likes & registrations */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <TouchableOpacity
              onPress={onLike}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Heart
                size={20}
                color={isLiked ? '#16a34a' : '#6b7280'}
                fill={isLiked ? '#16a34a' : 'none'}
              />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 14,
                  color: isLiked ? '#16a34a' : '#6b7280',
                }}
              >
                {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 24 }}>
              <Users size={16} color="#6b7280" />
              <Text style={{ marginLeft: 6, fontSize: 14, color: '#6b7280' }}>
                {registrationCount} Registered
              </Text>
            </View>
          </View>

          {/* RSVP */}
          {currentUserId !== selectedEvent.userId && (
            <TouchableOpacity
              disabled={isRegistered}
              onPress={onRSVP}
              style={{
                marginTop: 18,
                alignSelf: 'flex-end',
                backgroundColor: isRegistered ? '#6ee7b7' : '#01eb53',
                paddingHorizontal: 22,
                paddingVertical: 10,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontWeight: '600', fontSize: 14, color: '#fff' }}>
                {isRegistered ? 'Registered' : 'Register'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
