import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type AuthFlowScreenProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  iconName?: keyof typeof Ionicons.glyphMap;
};

export default function AuthFlowScreen({ title, subtitle, children, iconName }: AuthFlowScreenProps) {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#090d16' }}>
      <StatusBar barStyle="light-content" backgroundColor="#090d16" />

      {/* Header bar */}
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: '#090d16', borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.08)' }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
          <Ionicons name="chevron-back" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#f8fafc', marginLeft: 6 }}>{title}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 }}>
          {/* Glass Card Container matching Web */}
          <View style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.12)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.35,
            shadowRadius: 20,
            elevation: 10,
          }}>
            {iconName ? (
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(16, 185, 129, 0.18)', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 }}>
                <Ionicons name={iconName} size={30} color="#10b981" />
              </View>
            ) : null}
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff', textAlign: iconName ? 'center' : 'left' }}>{title}</Text>
            <Text style={{ marginTop: 8, marginBottom: 24, color: '#94a3b8', fontSize: 14, lineHeight: 20, textAlign: iconName ? 'center' : 'left' }}>{subtitle}</Text>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

