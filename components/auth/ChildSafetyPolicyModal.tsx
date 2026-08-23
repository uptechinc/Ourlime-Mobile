import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

type ChildSafetyPolicyModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
};

export default function ChildSafetyPolicyModal({ isOpen, onClose, onAccept }: ChildSafetyPolicyModalProps) {
  const router = useRouter();
  const { colors } = useAppTheme();

  const handleAccept = (): void => {
    onAccept?.();
    onClose();
  };

  const handleOpenFullPolicy = (): void => {
    onClose();
    router.push('/child-safety-standards');
  };

  return (
    <Modal visible={isOpen} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <SwipeDismissSurface visible={isOpen} onDismiss={onClose} handleColor={colors.border} accessibilityLabel="Swipe down to close child safety policy" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          <ShieldCheck size={23} color="#10b981" />
          <Text style={{ flex: 1, marginLeft: 10, color: colors.text, fontSize: 18, fontWeight: '900' }}>Child Safety Standards</Text>
          <TouchableOpacity accessibilityLabel="Close child safety policy" onPress={onClose} style={{ padding: 8 }}><X size={22} color={colors.icon} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 42 }}>
          <View style={{ padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.destructiveSurface }}>
            <Text style={{ color: colors.destructiveText, fontSize: 18, fontWeight: '900' }}>Zero tolerance for CSAE and CSAM</Text>
            <Text style={{ marginTop: 9, color: colors.destructiveText, lineHeight: 22 }}>Ourlime strictly prohibits child sexual abuse and exploitation, child sexual abuse material, grooming, trafficking, and the sexualization of minors.</Text>
          </View>
          <Text style={{ marginTop: 22, color: colors.text, fontSize: 16, fontWeight: '900' }}>Your responsibilities</Text>
          {[
            'Never create, request, possess, download, share, or redistribute suspected CSAM.',
            'Use the Child Safety report category immediately when you encounter an urgent concern.',
            'Do not attach suspected CSAM to a report. Ourlime securely includes the original content identifier.',
            'Cooperate with safety investigations and lawful reporting obligations.',
          ].map((item) => <View key={item} style={{ flexDirection: 'row', marginTop: 13 }}><View style={{ width: 7, height: 7, marginTop: 7, borderRadius: 4, backgroundColor: '#10b981' }} /><Text style={{ flex: 1, marginLeft: 10, color: colors.secondaryText, lineHeight: 21 }}>{item}</Text></View>)}
          <TouchableOpacity onPress={handleOpenFullPolicy} style={{ marginTop: 22, paddingVertical: 12 }}><Text style={{ color: colors.accent, fontWeight: '800', textDecorationLine: 'underline' }}>Read the complete public policy</Text></TouchableOpacity>
        </ScrollView>
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={handleAccept} style={{ minHeight: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '900' }}>Accept Child Safety Standards</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
      </SwipeDismissSurface>
    </Modal>
  );
}
