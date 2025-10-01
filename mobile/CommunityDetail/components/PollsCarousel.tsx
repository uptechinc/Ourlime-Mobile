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
import { mockPolls } from '../data.mock';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8;
const CARD_SPACING = 16;

interface PollsCarouselProps {
  onPollPress?: (pollId: string) => void;
  onVote?: (pollId: string, optionId: string) => void;
  onShare?: (pollId: string) => void;
}

export default function PollsCarousel({ onPollPress, onVote, onShare }: PollsCarouselProps) {
  const handlePollPress = (pollId: string) => {
    console.log('TODO: Navigate to poll details:', pollId);
    onPollPress?.(pollId);
  };

  const handleVote = (pollId: string, optionId: string) => {
    console.log('TODO: Vote on poll:', pollId, 'option:', optionId);
    onVote?.(pollId, optionId);
  };

  const handleShare = (pollId: string) => {
    console.log('TODO: Share poll:', pollId);
    onShare?.(pollId);
  };

  const renderPoll = (poll: any, index: number) => (
    <Pressable
      key={poll.id}
      onPress={() => handlePollPress(poll.id)}
      style={[styles.pollCarouselCard, { width: CARD_WIDTH }]}
    >
      <View style={styles.pollCarouselContent}>
        {/* Poll Header */}
        <View style={styles.pollCarouselHeader}>
          <Image
            source={{ uri: poll.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face' }}
            style={styles.pollCarouselAvatar}
          />
          <View style={styles.pollCarouselAuthorInfo}>
            <Text style={styles.pollCarouselAuthorName}>
              {poll.author.firstName} {poll.author.lastName}
            </Text>
            <Text style={styles.pollCarouselAuthorRole}>{poll.author.role}</Text>
          </View>
        </View>

        {/* Poll Question */}
        <Text style={styles.pollCarouselQuestion}>{poll.question}</Text>
        
        {/* Poll Options */}
        <View style={styles.pollCarouselOptions}>
          {poll.options.map((option: any) => {
            const percentage = (option.votes / poll.totalVotes) * 100;
            return (
              <Pressable
                key={option.id}
                onPress={() => handleVote(poll.id, option.id)}
                style={styles.pollCarouselOption}
              >
                <View style={styles.pollCarouselOptionHeader}>
                  <Text style={styles.pollCarouselOptionText}>{option.text}</Text>
                  <Text style={styles.pollCarouselOptionVotes}>{option.votes}</Text>
                </View>
                <View style={styles.pollCarouselOptionBar}>
                  <View 
                    style={[
                      styles.pollCarouselOptionFill, 
                      { width: `${percentage}%` }
                    ]} 
                  />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Poll Meta */}
        <View style={styles.pollCarouselMeta}>
          <Text style={styles.pollCarouselTimestamp}>
            {new Date(poll.timestamp).toLocaleString()}
          </Text>
          <Text style={styles.pollCarouselTotalVotes}>
            {poll.totalVotes} votes
          </Text>
        </View>

        {/* Poll Actions */}
        <View style={styles.pollCarouselActions}>
          <Pressable 
            onPress={() => handleVote(poll.id, '')}
            style={styles.pollCarouselActionButton}
          >
            <Text style={styles.pollCarouselActionText}>
              🤍 Vote
            </Text>
          </Pressable>

          <Pressable 
            onPress={() => handlePollPress(poll.id)}
            style={styles.pollCarouselActionButton}
          >
            <Text style={styles.pollCarouselActionText}>
              💬 Comment
            </Text>
          </Pressable>

          <Pressable 
            onPress={() => handleShare(poll.id)}
            style={styles.pollCarouselActionButton}
          >
            <Text style={styles.pollCarouselActionText}>
              📤 Share
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  if (mockPolls.length === 0) {
    return (
      <View style={styles.pollsCarouselContainer}>
        <Text style={styles.sectionTitle}>Community Polls</Text>
        <View style={styles.pollsPlaceholder}>
          <Text style={styles.placeholderText}>No active polls</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.pollsCarouselContainer}>
      <Text style={styles.sectionTitle}>Community Polls</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pollsCarousel}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
      >
        {mockPolls.map((poll, index) => renderPoll(poll, index))}
      </ScrollView>
    </View>
  );
}
