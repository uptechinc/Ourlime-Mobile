import type { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';

type AdminWorkspaceShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
};

export default function AdminWorkspaceShell({ title, subtitle, children, loading, refreshing, error, onRefresh }: AdminWorkspaceShellProps) {
  const router = useRouter();
  const { authorization, loading: accessLoading } = usePageAccess();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={{ padding: 7 }}>
          <Icon name="arrow-left" size={23} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontSize: 19, fontWeight: '900', color: '#0f172a' }}>{title}</Text>
          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 11, color: '#64748b' }}>{subtitle}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/admin')} accessibilityRole="button" accessibilityLabel="Admin overview" style={{ padding: 7 }}>
          <Icon name="grid" size={21} color="#10b981" />
        </TouchableOpacity>
      </View>

      {accessLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color="#10b981" /></View>
      ) : !authorization.isAdmin ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Icon name="lock" size={38} color="#c64d53" />
          <Text style={{ marginTop: 14, fontSize: 20, fontWeight: '900', color: '#0f172a' }}>Admin access required</Text>
          <TouchableOpacity onPress={handleBack} style={{ marginTop: 20, borderRadius: 999, backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 11 }}><Text style={{ color: '#ffffff', fontWeight: '800' }}>Go Back</Text></TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color="#10b981" /><Text style={{ marginTop: 11, color: '#64748b' }}>Loading {title.toLowerCase()}…</Text></View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}><Icon name="alert-triangle" size={36} color="#c64d53" /><Text style={{ marginTop: 12, textAlign: 'center', lineHeight: 20, color: '#991b1b' }}>{error}</Text><TouchableOpacity onPress={onRefresh} style={{ marginTop: 16, borderRadius: 999, backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 11 }}><Text style={{ color: '#ffffff', fontWeight: '800' }}>Retry</Text></TouchableOpacity></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}>
          {children}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
