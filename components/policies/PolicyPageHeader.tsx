import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type PolicyPageHeaderProps = { title: string };

/** Fixed top bar for the public policy pages; back falls through to the feed when the page was opened directly. */
export default function PolicyPageHeader({ title }: PolicyPageHeaderProps) {
  const router = useRouter();
  const { colors } = useAppTheme();

  const handleBackPress = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.navigation }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={handleBackPress} style={{ padding: 6 }}>
        <ChevronLeft size={26} color={colors.icon} />
      </TouchableOpacity>
      <Text numberOfLines={1} style={{ flex: 1, marginLeft: 6, color: colors.text, fontSize: 19, fontWeight: '900' }}>{title}</Text>
    </View>
  );
}
