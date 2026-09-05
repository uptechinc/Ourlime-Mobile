import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LimesScreen from '@/app/(tabs)/Limes';

// Unlike the tab route, this stack entry has no bottom navigation providing an inset.
export default function LimeViewerScreen() {
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: '#000' }}><LimesScreen /></View>;
}
