import { useState, useCallback, useMemo } from 'react';
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
import { useStickers } from '@/lib/hooks/useStickers';
import type { Sticker } from '@/lib/types/sticker';
import { getLocalStickerSource } from '@/assets/images/stickers/stickerMap';

type KeyboardTab = 'emojis' | 'stickers';

type EmojiStickerKeyboardProps = {
  visible: boolean;
  initialTab?: KeyboardTab;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onStickerSelect: (sticker: Sticker) => void;
  onBackspace?: () => void;
};

// ─── WhatsApp Emoji Catalog ──────────────────────────────────────────────────

const EMOJI_CATEGORIES: { id: string; name: string; icon: string; emojis: string[] }[] = [
  {
    id: 'frequent',
    name: 'Frequent',
    icon: 'clock',
    emojis: ['😀', '😂', '❤️', '🔥', '👍', '🎉', '😍', '🤔', '😭', '😡', '🙏', '💯', '✨', '🚀', '💪', '😎', '🥳', '🙌', '👀', '🤣', '🤩', '🏼'],
  },
  {
    id: 'smileys',
    name: 'Smileys',
    icon: 'smile',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍',
      '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩',
      '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭',
      '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🫣', '🤗', '🫡',
      '🤔', '🫢', '🤭', '🤫', '🤥', '😶', '😶‍🌫️', '😐', '😑', '😬', '🫨', '🫠', '🙄', '😯', '😦', '😧',
      '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕',
      '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃',
    ],
  },
  {
    id: 'people',
    name: 'People',
    icon: 'user',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫴', '🫳', '🫵', '👌', '🤌', '🤏', '✌️', '🤞', '🫰',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏',
      '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻',
      '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '🫦',
    ],
  },
  {
    id: 'nature',
    name: 'Nature',
    icon: 'sun',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
      '🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴',
      '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍',
      '🦎', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆',
      '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🪨', '🌾', '💐',
      '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻',
    ],
  },
  {
    id: 'food',
    name: 'Food',
    icon: 'coffee',
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝',
      '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯',
      '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕',
      '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚',
      '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '☕', '🍵',
      '🧃', '🥤', '🧋', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🍾', '🧊',
    ],
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: 'activity',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🏏', '🎯',
      '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🛹', '🛼', '🎿', '🏂', '🏋️', '🚴', '🏆', '🥇', '🥈',
      '🥉', '🏅', '🎖️', '🎫', '🎟️', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺',
      '🎸', '🎻', '🎲', '♟️', '🎳', '🎮', '🎰', '🧩',
    ],
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: 'package',
    emojis: [
      '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🕹️', '🎥', '📸', '📹', '📻', '📺', '⌛', '⏳', '⏰',
      '⏱️', '⏲️', '🕰️', '💡', '🔦', '🕯️', '💸', '💵', '💴', '💶', '💳', '💎', '⚖️', '🛠️', '🔨', '💣',
      '🔪', '🗡️', '⚔️', '🛡️', '🚬', '📦', '📫', '🎁', '🎈', '🎉', '🎊', '🎀', '🏷️', '🔑', '🗝️',
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: 'heart',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '❤️‍🔥', '❤️‍🩹', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬', '👁️‍🗨️', '🗨️', '🗯️',
      '💭', '💤', '🛑', '🚫', '❌', '⭕', '✅', '☑️', '✔️', '➕', '➖', '➗', '🔴', '🟠', '🟡', '🟢',
      '🔵', '🟣', '⬛', '⬜', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪',
    ],
  },
];

export function EmojiStickerKeyboard({
  visible,
  initialTab = 'emojis',
  onClose,
  onEmojiSelect,
  onStickerSelect,
  onBackspace,
}: EmojiStickerKeyboardProps) {
  const [activeTab, setActiveTab] = useState<KeyboardTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Sticker pack state
  const [activePackId, setActivePackId] = useState('all');
  const { packs, stickers, recentStickers, loading: stickersLoading, addRecentlyUsed } = useStickers(
    activeTab === 'stickers' ? searchQuery : '',
    activePackId
  );

  // Active Emoji Category
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('smileys');

  const filteredEmojiCategories = useMemo(() => {
    if (!searchQuery.trim() || activeTab !== 'emojis') {
      return EMOJI_CATEGORIES;
    }
    const q = searchQuery.toLowerCase().trim();
    return EMOJI_CATEGORIES.map((cat) => ({
      ...cat,
      emojis: cat.emojis.filter((e) => e.includes(q)),
    })).filter((cat) => cat.emojis.length > 0);
  }, [searchQuery, activeTab]);

  const handleSelectSticker = useCallback(
    (sticker: Sticker) => {
      void addRecentlyUsed(sticker.id);
      onStickerSelect(sticker);
      onClose();
    },
    [addRecentlyUsed, onStickerSelect, onClose]
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={onClose} />

      {/* WhatsApp Keyboard Sheet Container */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          height: 380,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        {/* Top Header & Search Bar */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9',
          gap: 10,
        }}>
          {/* Search Box */}
          <View style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f1f5f9',
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}>
            <Icon name="search" size={15} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: '#0f172a', padding: 0 }}
              placeholder={activeTab === 'emojis' ? 'Search emojis...' : 'Search stickers...'}
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

          {/* Close button */}
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Icon name="chevron-down" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* EMOJIS TAB CONTENT */}
        {activeTab === 'emojis' && (
          <View style={{ flex: 1 }}>
            {/* Category Pill Bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ maxHeight: 42, borderBottomWidth: 1, borderBottomColor: '#f8fafc' }}
              contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'center', gap: 4 }}
            >
              {EMOJI_CATEGORIES.map((cat) => {
                const isActive = activeEmojiCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setActiveEmojiCategory(cat.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 14,
                      backgroundColor: isActive ? '#dcfce7' : 'transparent',
                    }}
                  >
                    <Icon name={cat.icon} size={16} color={isActive ? '#10b981' : '#94a3b8'} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Emoji Grid Stream */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {filteredEmojiCategories
                .filter((cat) => !searchQuery || cat.id === activeEmojiCategory || searchQuery.length > 0)
                .map((cat) => (
                  <View key={cat.id} style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.8, marginBottom: 6, paddingHorizontal: 4 }}>
                      {cat.name.toUpperCase()}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {cat.emojis.map((emoji, index) => (
                        <TouchableOpacity
                          key={`${cat.id}-${index}-${emoji}`}
                          onPress={() => onEmojiSelect(emoji)}
                          style={{
                            width: '14.28%',
                            aspectRatio: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 8,
                          }}
                          activeOpacity={0.6}
                        >
                          <Text style={{ fontSize: 26 }}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
            </ScrollView>
          </View>
        )}

        {/* STICKERS TAB CONTENT */}
        {activeTab === 'stickers' && (
          <View style={{ flex: 1 }}>
            {/* Pack Tabs Bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ maxHeight: 42, borderBottomWidth: 1, borderBottomColor: '#f8fafc' }}
              contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'center', gap: 6 }}
            >
              <TouchableOpacity
                onPress={() => setActivePackId('all')}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 14,
                  backgroundColor: activePackId === 'all' ? '#10b981' : '#f1f5f9',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: activePackId === 'all' ? '#ffffff' : '#64748b' }}>
                  All
                </Text>
              </TouchableOpacity>

              {packs.map((pack) => {
                const packIconSource = getLocalStickerSource(pack.icon) ?? (pack.icon ? { uri: pack.icon } : null);
                const isActive = activePackId === pack.id;
                return (
                  <TouchableOpacity
                    key={pack.id}
                    onPress={() => setActivePackId(pack.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 14,
                      backgroundColor: isActive ? '#10b981' : '#f1f5f9',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {packIconSource ? (
                      <Image source={packIconSource} style={{ width: 16, height: 16, borderRadius: 3 }} resizeMode="contain" />
                    ) : null}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? '#ffffff' : '#64748b' }}>
                      {pack.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sticker Grid */}
            {stickersLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color="#10b981" />
              </View>
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8, paddingBottom: 16 }}
                showsVerticalScrollIndicator={false}
              >
                {recentStickers.length > 0 && !searchQuery && activePackId === 'all' && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.8, marginBottom: 6, paddingHorizontal: 4 }}>
                      RECENT STICKERS
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {recentStickers.map((stk) => (
                        <KeyboardStickerTile key={`recent-${stk.id}`} sticker={stk} onSelect={handleSelectSticker} />
                      ))}
                    </View>
                  </View>
                )}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {stickers.map((stk) => (
                    <KeyboardStickerTile key={stk.id} sticker={stk} onSelect={handleSelectSticker} />
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        )}

        {/* Bottom WhatsApp Mode Switcher Bar (Emojis | Stickers | Backspace) */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#f1f5f9',
            paddingVertical: 8,
            paddingHorizontal: 16,
          }}
        >
          {/* Emojis Mode Button */}
          <TouchableOpacity
            onPress={() => setActiveTab('emojis')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 6,
              borderRadius: 18,
              backgroundColor: activeTab === 'emojis' ? '#dcfce7' : 'transparent',
              gap: 6,
            }}
          >
            <Icon name="smile" size={20} color={activeTab === 'emojis' ? '#10b981' : '#94a3b8'} />
            <Text style={{ fontSize: 13, fontWeight: activeTab === 'emojis' ? '700' : '500', color: activeTab === 'emojis' ? '#10b981' : '#64748b' }}>
              Emojis
            </Text>
          </TouchableOpacity>

          {/* Stickers Mode Button */}
          <TouchableOpacity
            onPress={() => setActiveTab('stickers')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 6,
              borderRadius: 18,
              backgroundColor: activeTab === 'stickers' ? '#dcfce7' : 'transparent',
              gap: 6,
            }}
          >
            <Icon name="grid" size={20} color={activeTab === 'stickers' ? '#10b981' : '#94a3b8'} />
            <Text style={{ fontSize: 13, fontWeight: activeTab === 'stickers' ? '700' : '500', color: activeTab === 'stickers' ? '#10b981' : '#64748b' }}>
              Stickers
            </Text>
          </TouchableOpacity>

          {/* Backspace Button */}
          {onBackspace && (
            <TouchableOpacity onPress={onBackspace} style={{ padding: 8 }}>
              <Icon name="delete" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

function KeyboardStickerTile({ sticker, onSelect }: { sticker: Sticker; onSelect: (stk: Sticker) => void }) {
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
        <Text style={{ fontSize: 26 }}>🎨</Text>
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
