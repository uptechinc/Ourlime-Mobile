import { Text, TouchableOpacity, View } from 'react-native';
import { useAppData } from '@/lib/contexts/AppDataContext';

/** Shown when the secure E-Projects session failed to connect, with a Retry button (instead of "still connecting" forever). */
export default function SessionRetryBanner() {
  const { nativeSession, retryNativeSession } = useAppData();
  if (nativeSession.status !== 'retryable_failure') return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginHorizontal: 16, marginVertical: 8, borderRadius: 14, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#f59e0b' }}>
      <Text style={{ flex: 1, color: '#78350f', fontSize: 13 }}>
        {nativeSession.error || 'The secure session could not connect.'} Changes are paused until it connects.
      </Text>
      <TouchableOpacity onPress={retryNativeSession} accessibilityRole="button" accessibilityLabel="Retry secure session" style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f59e0b' }}>
        <Text style={{ color: '#ffffff', fontWeight: '800' }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}
