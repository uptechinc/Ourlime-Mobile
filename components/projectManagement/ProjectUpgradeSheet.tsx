import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Clock, Sparkles, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { ProjectPlanTier } from '@/lib/types/project';

type ProjectUpgradeSheetProps = {
  visible: boolean;
  projectName: string;
  currentTier: ProjectPlanTier;
  onClose: () => void;
  onUpgrade: () => Promise<void>;
};

/**
 * Only what Premium actually changes in the app today: the timesheet CSV export. Budgets, risk registers, more
 * automations, 1 GB uploads and the old subtask / milestone caps were listed before but do not exist (audit D6/D7),
 * and the timeline and workload views are open to every project, so none of that is promised here.
 */
const PREMIUM_BENEFITS = [
  { Icon: Clock, title: 'Timesheet export', desc: 'Download the project’s time log as a spreadsheet.' },
];
const COMPARISON = [
  { label: 'Tasks, checklists, milestones, team', free: 'Included', premium: 'Included' },
  { label: 'Timeline and workload views', free: 'Included', premium: 'Included' },
  { label: 'Timesheet CSV export', free: '✕', premium: 'Included' },
];

/** Website UpgradeTierModal: Premium benefits, plan comparison and the upgrade action. */
export default function ProjectUpgradeSheet({ visible, projectName, currentTier, onClose, onUpgrade }: ProjectUpgradeSheetProps) {
  const { colors } = useAppTheme();
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async (): Promise<void> => {
    if (upgrading) return;
    setUpgrading(true);
    try {
      await onUpgrade();
      toast.success(`${projectName} upgraded to Premium!`);
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to upgrade project');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { if (!upgrading) onClose(); }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={onClose} disabled={upgrading} accessibilityLabel="Close" style={{ padding: 6 }}><X size={22} color={colors.text} /></TouchableOpacity>
          <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 16, fontWeight: '900' }}>Unlock power tools for {projectName}</Text>
          <View style={{ width: 34 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
          <Text style={{ color: colors.secondaryText, fontSize: 14, lineHeight: 20 }}>
            Everything you need to run a project is free. Premium currently adds timesheet export; new Premium tools will be listed here when they are ready.
          </Text>
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.successSurface }}>
            <Sparkles size={14} color={colors.accent} />
            <Text style={{ color: colors.successText, fontSize: 12, fontWeight: '800' }}>Ourlime E-Projects Premium</Text>
          </View>
          {PREMIUM_BENEFITS.map(({ Icon, title, desc }) => (
            <View key={title} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface }}><Icon size={17} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{title}</Text>
                <Text style={{ color: colors.mutedText, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{desc}</Text>
              </View>
            </View>
          ))}
          <View style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 8 }}>
            <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>PLAN COMPARISON</Text>
            {COMPARISON.map((row) => (
              <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ flex: 1, color: colors.secondaryText, fontSize: 12 }}>{row.label}</Text>
                <Text style={{ color: colors.mutedText, fontSize: 12, fontWeight: '700', marginRight: 10 }}>Free: {row.free}</Text>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>Premium: {row.premium}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={onClose} disabled={upgrading} style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>Maybe later</Text>
          </TouchableOpacity>
          {currentTier === 'premium' ? (
            <View style={{ flex: 1.4, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color={colors.accent} />
              <Text style={{ color: colors.accent, fontWeight: '800' }}>Project is on Premium Plan</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => void handleUpgrade()} disabled={upgrading} style={{ flex: 1.4, height: 46, borderRadius: 12, backgroundColor: colors.accent, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', opacity: upgrading ? 0.7 : 1 }}>
              {upgrading ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Sparkles size={16} color={colors.onAccent} />}
              <Text style={{ color: colors.onAccent, fontWeight: '900' }}>{upgrading ? 'Upgrading project…' : 'Upgrade project now'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
