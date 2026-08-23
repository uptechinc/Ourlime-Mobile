import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStickers } from '@/lib/hooks/useStickers';
import type { Sticker } from '@/lib/types/sticker';
import { getLocalStickerSource } from '@/assets/images/stickers/stickerMap';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

type StickerPickerProps = {
  visible: boolean;
  onClose: () => void;
  onStickerSelect: (sticker: Sticker) => void;
};

export function StickerPicker({ visible, onClose, onStickerSelect }: StickerPickerProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activePackId, setActivePackId] = useState('all');

  const { packs, stickers, recentStickers, loading, addRecentlyUsed } = useStickers(searchQuery, activePackId);

  const handleSelect = useCallback(
    (sticker: Sticker) => {
      void addRecentlyUsed(sticker.id);
      onStickerSelect(sticker);
      onClose();
    },
    [addRecentlyUsed, onStickerSelect, onClose]
  );

  const showRecent = !searchQuery && activePackId === 'all' && recentStickers.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
        onPress={onClose}
      />

      {/* Panel */}
      <SwipeDismissSurface
        visible={visible}
        onDismiss={onClose}
        handleColor="#d1d5db"
        accessibilityLabel="Swipe down to close sticker picker"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '72%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 12,
          paddingBottom: insets.bottom,
        }}
      >
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' }} />
        </View>

        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827', flex: 1 }}>Stickers</Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Icon name="x" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f1f5f9',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}>
            <Icon name="search" size={15} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: '#0f172a' }}
              placeholder="Search stickers..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="x-circle" size={15} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Pack tabs — "All" + real Firestore / local packs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 48, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8, alignItems: 'center' }}
        >
          {/* All tab */}
          <TouchableOpacity
            onPress={() => setActivePackId('all')}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 16,
              backgroundColor: activePackId === 'all' ? '#10b981' : '#f1f5f9',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: activePackId === 'all' ? '#ffffff' : '#475569' }}>
              All
            </Text>
          </TouchableOpacity>

          {/* Pack tabs */}
          {packs.map((pack) => {
            const packIconSource = getLocalStickerSource(pack.icon) ?? (pack.icon ? { uri: pack.icon } : null);
            return (
              <TouchableOpacity
                key={pack.id}
                onPress={() => setActivePackId(pack.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 16,
                  backgroundColor: activePackId === pack.id ? '#10b981' : '#f1f5f9',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {packIconSource ? (
                  <Image
                    source={packIconSource}
                    style={{ width: 18, height: 18, borderRadius: 4 }}
                    resizeMode="contain"
                  />
                ) : null}
                <Text style={{ fontSize: 13, fontWeight: '700', color: activePackId === pack.id ? '#ffffff' : '#475569' }}>
                  {pack.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sticker content */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={{ marginTop: 12, color: '#94a3b8', fontSize: 14 }}>Loading stickers...</Text>
          </View>
        ) : stickers.length === 0 && recentStickers.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
            <Icon name="smile" size={36} color="#cbd5e1" />
            <Text style={{ marginTop: 10, color: '#94a3b8', fontSize: 14 }}>
              {searchQuery ? `No stickers found for "${searchQuery}"` : 'No stickers available'}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1, marginTop: 12 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Recent section */}
            {showRecent && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 }}>
                  RECENT
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {recentStickers.map((sticker) => (
                    <StickerTile
                      key={`recent-${sticker.id}`}
                      sticker={sticker}
                      onSelect={handleSelect}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Main sticker grid */}
            {stickers.length > 0 && (
              <View>
                {!searchQuery && activePackId === 'all' && recentStickers.length > 0 && (
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 }}>
                    ALL STICKERS
                  </Text>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {stickers.map((sticker) => (
                    <StickerTile
                      key={sticker.id}
                      sticker={sticker}
                      onSelect={handleSelect}
                    />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SwipeDismissSurface>
    </Modal>
  );
}

type StickerTileProps = {
  sticker: Sticker;
  onSelect: (sticker: Sticker) => void;
};

function StickerTile({ sticker, onSelect }: StickerTileProps) {
  const [errored, setErrored] = useState(false);
  const localSource = getLocalStickerSource(sticker.imageUrl);
  const imageSource = localSource ?? { uri: sticker.imageUrl };

  return (
    <TouchableOpacity
      onPress={() => onSelect(sticker)}
      style={{
        width: '23%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        margin: '1%',
        padding: 4,
      }}
      activeOpacity={0.7}
    >
      {errored ? (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 28 }}>🎨</Text>
        </View>
      ) : (
        <Image
          source={imageSource}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
          onError={() => setErrored(true)}
        />
      )}
    </TouchableOpacity>
  );
}
