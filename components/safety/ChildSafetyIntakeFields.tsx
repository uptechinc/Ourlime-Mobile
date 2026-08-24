import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { ChildSafetyDangerAnswer, ChildSafetyIntakeValues } from '@/lib/types/childSafety';

type ChildSafetyIntakeFieldsProps = ChildSafetyIntakeValues & {
  onImmediateDangerChange: (answer: ChildSafetyDangerAnswer) => void;
  onGoodFaithAcknowledgedChange: (acknowledged: boolean) => void;
  onAllowContactChange: (allowContact: boolean) => void;
};

export default function ChildSafetyIntakeFields({
  immediateDanger,
  goodFaithAcknowledged,
  allowContact,
  onImmediateDangerChange,
  onGoodFaithAcknowledgedChange,
  onAllowContactChange,
}: ChildSafetyIntakeFieldsProps) {
  const { colors } = useAppTheme();
  return <View style={{ marginTop: 14 }}>
    <Text style={{ marginBottom: 8, color: colors.secondaryText, fontWeight: '800' }}>Is anyone in immediate danger?</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>{(['yes', 'no', 'unsure'] as const).map((answer) => <TouchableOpacity key={answer} onPress={() => onImmediateDangerChange(answer)} style={{ flex: 1, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: immediateDanger === answer ? colors.destructive : colors.border, backgroundColor: immediateDanger === answer ? colors.destructiveSurface : colors.surface }}><Text style={{ color: immediateDanger === answer ? colors.destructiveText : colors.secondaryText, fontWeight: '800', textTransform: 'capitalize' }}>{answer}</Text></TouchableOpacity>)}</View>
    {immediateDanger === 'yes' ? <View style={{ marginTop: 10, padding: 12, borderRadius: 13, backgroundColor: colors.destructiveSurface }}><Text style={{ color: colors.destructiveText, lineHeight: 19, fontWeight: '700' }}>If a child is in immediate danger, contact local emergency services now. An Ourlime report does not replace emergency assistance.</Text></View> : null}
    <View style={{ marginTop: 11, padding: 12, borderRadius: 13, backgroundColor: colors.warningSurface }}><Text style={{ color: colors.warningText, fontWeight: '900' }}>Do not attach suspected CSAM.</Text><Text style={{ marginTop: 5, color: colors.warningText, lineHeight: 19 }}>Do not download, copy, forward, email, upload, or redistribute it. Ourlime captures the original target identifier securely.</Text></View>
    <TouchableOpacity onPress={() => onGoodFaithAcknowledgedChange(!goodFaithAcknowledged)} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 }}><Ionicons name={goodFaithAcknowledged ? 'checkbox' : 'square-outline'} size={22} color={goodFaithAcknowledged ? colors.accent : colors.icon} /><Text style={{ flex: 1, marginLeft: 8, color: colors.secondaryText, lineHeight: 19 }}>I confirm this report is accurate to the best of my knowledge and submitted in good faith.</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => onAllowContactChange(!allowContact)} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 11 }}><Ionicons name={allowContact ? 'checkbox' : 'square-outline'} size={22} color={allowContact ? colors.accent : colors.icon} /><Text style={{ flex: 1, marginLeft: 8, color: colors.secondaryText, lineHeight: 19 }}>Ourlime may contact me for additional information.</Text></TouchableOpacity>
  </View>;
}
