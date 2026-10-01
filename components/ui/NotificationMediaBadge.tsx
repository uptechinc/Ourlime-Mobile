import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import UserAvatar from './UserAvatar';
import CachedImage from './CachedImage';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import {
  NotificationMediaResolverService,
  type NotificationEntityKind,
} from '@/lib/services/NotificationMediaResolverService';
import type { NotificationData } from '@/lib/types/notification';

export type NotificationMediaBadgeProps = {
  notification: NotificationData;
  size?: number;
  showBadge?: boolean;
};

const resolver = NotificationMediaResolverService.getInstance();

function getEntityBackgroundColor(kind: NotificationEntityKind): string {
  switch (kind) {
    case 'community':
      return '#f59e0b';
    case 'blog':
      return '#6366f1';
    case 'product':
      return '#f97316';
    case 'event':
      return '#ec4899';
    case 'course':
      return '#14b8a6';
    case 'project':
      return '#8b5cf6';
    case 'system':
      return '#64748b';
    case 'user':
    default:
      return '#10b981';
  }
}

export default function NotificationMediaBadge({
  notification,
  size = 46,
  showBadge = true,
}: NotificationMediaBadgeProps) {
  const { colors } = useAppTheme();
  const [, setTick] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);

  // Synchronously resolve media info
  const media = resolver.resolveMedia(notification);

  // Subscribe to background hydration updates
  useEffect(() => {
    return resolver.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  // Hydrate missing media asynchronously
  useEffect(() => {
    setImageFailed(false);
    if (!media.imageUrl) {
      void resolver.hydrateMediaAsync(notification);
    }
  }, [notification, media.imageUrl]);

  const isUser = media.entityKind === 'user';
  const badgeSize = Math.max(16, Math.round(size * 0.42));
  const badgeIconSize = Math.max(9, Math.round(badgeSize * 0.58));
  const borderRadius = isUser ? size / 2 : 12;
  const hasValidImage = Boolean(media.imageUrl && !imageFailed);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {isUser ? (
        <UserAvatar
          profileImage={hasValidImage ? media.imageUrl : null}
          firstName={media.displayName || 'U'}
          size={size}
          backgroundColor={getEntityBackgroundColor('user')}
        />
      ) : (
        <View
          style={[
            styles.entityImageWrapper,
            {
              width: size,
              height: size,
              borderRadius,
              backgroundColor: getEntityBackgroundColor(media.entityKind),
            },
          ]}
        >
          {hasValidImage ? (
            <CachedImage
              uri={media.imageUrl!}
              style={{ width: size, height: size, borderRadius }}
              accessibilityLabel={`${media.displayName} image`}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Text
              style={[
                styles.initialText,
                { fontSize: Math.max(11, Math.round(size * 0.36)) },
              ]}
            >
              {media.initials}
            </Text>
          )}
        </View>
      )}

      {/* Pinned Action Badge Overlay */}
      {showBadge && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: media.badgeBg,
              borderColor: colors.surface || '#ffffff',
            },
          ]}
        >
          <Icon name={media.badgeIcon} size={badgeIconSize} color={media.badgeColor || '#ffffff'} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityImageWrapper: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    color: '#ffffff',
    fontWeight: '800',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 3,
  },
});
