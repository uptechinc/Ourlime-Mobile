import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { openGraphService, extractDomain, type LinkPreviewData } from '@/lib/services/OpenGraphService';

type LinkPreviewMessageProps = {
  url: string;
  isOwn?: boolean;
};

/**
 * LinkPreviewMessage — Card shown inside chat bubbles for messages containing links.
 */
export function LinkPreviewMessage({ url, isOwn = false }: LinkPreviewMessageProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    openGraphService.fetchPreview(url).then((data) => {
      if (isMounted) {
        setPreview(data);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [url]);

  const domain = preview?.domain ?? extractDomain(url);

  return (
    <TouchableOpacity
      onPress={() => void Linking.openURL(url)}
      activeOpacity={0.8}
      style={{
        marginTop: 6,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : '#f8fafc',
        borderWidth: 1,
        borderColor: isOwn ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
      }}
    >
      {/* Preview Image */}
      {preview?.image && (
        <Image
          source={{ uri: preview.image }}
          style={{ width: '100%', height: 130, backgroundColor: isOwn ? 'rgba(0,0,0,0.1)' : '#e2e8f0' }}
          resizeMode="cover"
        />
      )}

      <View style={{ padding: 10 }}>
        {/* Domain tag */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Icon name="globe" size={11} color={isOwn ? 'rgba(255,255,255,0.8)' : '#10b981'} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: isOwn ? 'rgba(255,255,255,0.85)' : '#10b981', marginLeft: 4, textTransform: 'lowercase' }}>
            {preview?.siteName ?? domain}
          </Text>
        </View>

        {/* Title */}
        {isLoading ? (
          <ActivityIndicator size="small" color={isOwn ? '#ffffff' : '#10b981'} style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
        ) : (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: isOwn ? '#ffffff' : '#1e293b',
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {preview?.title ?? url}
          </Text>
        )}

        {/* Description */}
        {preview?.description && (
          <Text
            style={{
              fontSize: 11,
              color: isOwn ? 'rgba(255,255,255,0.75)' : '#64748b',
              marginTop: 3,
              lineHeight: 15,
            }}
            numberOfLines={2}
          >
            {preview.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

type LinkInputBannerProps = {
  url: string;
  onDismiss: () => void;
};

/**
 * LinkInputBanner — Live card banner shown above input box when user types a link.
 */
export function LinkInputBanner({ url, onDismiss }: LinkInputBannerProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    openGraphService.fetchPreview(url).then((data) => {
      if (isMounted) {
        setPreview(data);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [url]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderTopWidth: 2,
        borderTopColor: '#10b981',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 10,
      }}
    >
      {/* Thumbnail */}
      {preview?.image ? (
        <Image source={{ uri: preview.image }} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#f1f5f9' }} />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="link" size={20} color="#10b981" />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Link Preview · {preview?.siteName ?? extractDomain(url)}
        </Text>
        {isLoading ? (
          <ActivityIndicator size="small" color="#10b981" style={{ alignSelf: 'flex-start', marginTop: 2 }} />
        ) : (
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }} numberOfLines={1}>
            {preview?.title ?? url}
          </Text>
        )}
      </View>

      <TouchableOpacity onPress={onDismiss} style={{ padding: 6 }}>
        <Icon name="x" size={18} color="#94a3b8" />
      </TouchableOpacity>
    </View>
  );
}
