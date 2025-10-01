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
import { mockEvents } from '../data.mock';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8;
const CARD_SPACING = 16;

interface EventsCarouselProps {
  onEventPress?: (eventId: string) => void;
  onShare?: (eventId: string) => void;
}

export default function EventsCarousel({ onEventPress, onShare }: EventsCarouselProps) {
  const handleEventPress = (eventId: string) => {
    console.log('TODO: Navigate to event details:', eventId);
    onEventPress?.(eventId);
  };

  const handleShare = (eventId: string) => {
    console.log('TODO: Share event:', eventId);
    onShare?.(eventId);
  };

  const renderEvent = (event: any, index: number) => (
    <Pressable
      key={event.id}
      onPress={() => handleEventPress(event.id)}
      style={[
        styles.eventCard,
        { 
          width: CARD_WIDTH,
          marginLeft: index === 0 ? 0 : CARD_SPACING,
        }
      ]}
    >
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=200&fit=crop' }}
        style={styles.eventCardImage}
        resizeMode="cover"
      />
      <View style={styles.eventCardContent}>
        <Text style={styles.eventCardTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.eventCardDescription} numberOfLines={2}>
          {event.description}
        </Text>
        <View style={styles.eventCardMeta}>
          <Text style={styles.eventCardDate}>
            {new Date(event.date).toLocaleDateString()}
          </Text>
          <Text style={styles.eventCardLocation}>
            📍 {event.location}
          </Text>
        </View>
        <View style={styles.eventCardFooter}>
          <Text style={styles.eventCardAttendees}>
            👥 {event.attendees}/{event.maxAttendees} attending
          </Text>
          <View style={styles.eventCardActions}>
            <View style={styles.eventCardStatus}>
              <Text style={styles.eventCardStatusText}>
                {event.attendees < event.maxAttendees ? 'Open' : 'Full'}
              </Text>
            </View>
            <Pressable 
              onPress={() => handleShare(event.id)}
              style={styles.eventShareButton}
            >
              <Text style={styles.eventShareText}>📤</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );

  if (mockEvents.length === 0) {
    return (
      <View style={styles.eventsCarouselContainer}>
        <Text style={styles.sectionTitle}>Community Events</Text>
        <View style={styles.eventsPlaceholder}>
          <Text style={styles.placeholderText}>No events scheduled</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.eventsCarouselContainer}>
      <Text style={styles.sectionTitle}>Community Events</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.eventsCarousel}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
      >
        {mockEvents.map((event, index) => renderEvent(event, index))}
      </ScrollView>
    </View>
  );
}
