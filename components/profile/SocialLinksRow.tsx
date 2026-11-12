import type { ComponentProps } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { profileAboutService, type SocialLinkKey, type SocialLinks } from '@/lib/services/ProfileAboutService';

type SocialLinksRowProps = {
  socialLinks: SocialLinks;
  /** Compact = icon chips only (profile header); otherwise chips show the handle (About tab). */
  compact?: boolean;
};

const SOCIAL_ICONS: Record<SocialLinkKey, ComponentProps<typeof Ionicons>['name']> = {
  x: 'logo-twitter',
  facebook: 'logo-facebook',
  instagram: 'logo-instagram',
  tiktok: 'logo-tiktok',
  linkedIn: 'logo-linkedin',
  youtube: 'logo-youtube',
  github: 'logo-github',
  discord: 'logo-discord',
  snapchat: 'logo-snapchat',
  pinterest: 'logo-pinterest',
};

/** The website's SocialLinksDisplay: one tappable chip per linked platform. */
export default function SocialLinksRow({ socialLinks, compact = false }: SocialLinksRowProps) {
  const { colors } = useAppTheme();
  const items = profileAboutService.toSocialLinkItems(socialLinks);
  if (items.length === 0) return null;

  const handleOpen = (url: string): void => {
    void Linking.openURL(url).catch((error: unknown) => console.error('[SocialLinksRow.handleOpen] Error:', error));
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          onPress={() => handleOpen(item.url)}
          accessibilityRole="link"
          accessibilityLabel={`${item.name}: ${item.value}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            minHeight: 36,
            paddingHorizontal: compact ? 10 : 12,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.control,
          }}
        >
          <Ionicons name={SOCIAL_ICONS[item.key]} size={16} color={colors.accentText} />
          {compact ? null : <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: '700', maxWidth: 180 }}>{item.value}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}
