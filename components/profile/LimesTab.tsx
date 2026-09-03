import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Reel } from '@/types/userTypes';
import { limeService } from '@/lib/services/LimeService';
import { AuthService } from '@/lib/services/AuthService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import CreateLimeModal from '@/components/limes/CreateLimeModal';

import { limeThumbnailService } from '@/lib/services/LimeThumbnailService';

type LimesTabProps = {
  userId: string;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_GAP = 8;
const HORIZONTAL_PADDING = 12;
const NUM_COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - COLUMN_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = CARD_WIDTH * (16 / 9);

const authService = AuthService.getInstance();

export default function LimesTab({ userId }: LimesTabProps) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const currentUserId = authService.getCurrentUser()?.uid ?? '';
  const isOwnProfile = currentUserId === userId;

  const [limes, setLimes] = useState<Reel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const loadLimes = useCallback(async () => {
    try {
      let data = await limeService.fetchUserAndRepostedReels(userId);
      const missing = data.filter((r) => !r.thumbnailUrl && !r.media?.thumbnailUrl);

      if (missing.length > 0) {
        setLoadingMessage('some of your limes are missing thumbnaills, lime a bit while we set them for you...');
        data = await Promise.all(
          data.map(async (reel) => {
            if (reel.thumbnailUrl || reel.media?.thumbnailUrl) return reel;
            try {
              const generated = await limeThumbnailService.ensureReelThumbnail(reel, currentUserId);
              if (generated) {
                return {
                  ...reel,
                  thumbnailUrl: generated,
                  media: {
                    ...reel.media,
                    thumbnailUrl: generated,
                  },
                };
              }
            } catch (err) {
              console.warn('[LimesTab] Auto-thumbnail error:', err);
            }
            return reel;
          })
        );
      }

      setLimes(data);
    } catch (err) {
      console.error('[LimesTab] Error loading limes:', err);
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  }, [currentUserId, userId]);

  useEffect(() => {
    void loadLimes();
  }, [loadLimes]);

  const handleLimePress = (reel: Reel) => {
    router.push({
      pathname: '/(tabs)/Limes',
      params: { limeId: reel.id },
    });
  };

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 }}>
        <ActivityIndicator size="small" color="#10b981" />
        {loadingMessage ? (
          <Text
            style={{
              marginTop: 14,
              fontSize: 13,
              fontWeight: '600',
              color: colors.secondaryText,
              textAlign: 'center',
              lineHeight: 18,
            }}
          >
            {loadingMessage}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: HORIZONTAL_PADDING, paddingVertical: 12 }}>
      {/* Header / Create Lime Action */}
      {isOwnProfile && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
            Limes ({limes.length})
          </Text>
          <TouchableOpacity
            onPress={() => setCreateModalVisible(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#10b981',
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
            }}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Create Lime</Text>
          </TouchableOpacity>
        </View>
      )}

      {limes.length === 0 ? (
        <View
          style={{
            paddingVertical: 44,
            alignItems: 'center',
            paddingHorizontal: 24,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="videocam-outline" size={44} color={colors.secondaryText} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 }}>
            No Limes yet
          </Text>
          <Text style={{ fontSize: 13, color: colors.secondaryText, textAlign: 'center', marginTop: 4 }}>
            {isOwnProfile
              ? 'Share short video moments with your community.'
              : 'This user has not shared any Limes yet.'}
          </Text>
          {isOwnProfile && (
            <TouchableOpacity
              onPress={() => setCreateModalVisible(true)}
              style={{
                marginTop: 16,
                backgroundColor: '#10b981',
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 22,
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>
                + Create First Lime
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: COLUMN_GAP,
          }}
        >
          {limes.map((item) => {
            const thumbnail = item.thumbnailUrl || item.media?.thumbnailUrl;
            const likeCount = item.stats?.likes || item.likes?.length || 0;
            const isRepost = item.isRepost === true;

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleLimePress(item)}
                activeOpacity={0.85}
                style={{
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  borderRadius: 14,
                  overflow: 'hidden',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: COLUMN_GAP,
                }}
              >
                {thumbnail ? (
                  <Image
                    source={{ uri: thumbnail }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#0f172a',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="videocam" size={32} color="#10b981" />
                  </View>
                )}

                {/* Repost Badge */}
                {isRepost && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      paddingHorizontal: 7,
                      paddingVertical: 3,
                      borderRadius: 10,
                    }}
                  >
                    <Ionicons name="repeat" size={12} color="#10b981" />
                    <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }}>
                      Repost
                    </Text>
                  </View>
                )}

                {/* Bottom Overlay Stats */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 8,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                  }}
                >
                  {item.caption ? (
                    <Text
                      numberOfLines={1}
                      style={{ color: '#ffffff', fontSize: 11, fontWeight: '600', marginBottom: 4 }}
                    >
                      {item.caption}
                    </Text>
                  ) : null}

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="heart" size={12} color="#ef4444" />
                      <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>
                        {likeCount}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="chatbubble" size={11} color="#ffffff" />
                      <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '600' }}>
                        {item.stats?.comments || 0}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Create Lime Modal */}
      {isOwnProfile && (
        <CreateLimeModal
          isOpen={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          onSuccess={() => {
            setCreateModalVisible(false);
            void loadLimes();
          }}
        />
      )}
    </View>
  );
}
