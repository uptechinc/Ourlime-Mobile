import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Clock, DollarSign, Layers, ShieldAlert, Sparkles, Users, X, Zap } from 'lucide-react-native';
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

// Same benefits and comparison as the website's UpgradeTierModal.
const PREMIUM_BENEFITS = [
  { Icon: Layers, title: 'Gantt Charts & Visual Timeline', desc: 'Interactive schedule with task dependencies and milestone tracking.' },
  { Icon: Users, title: 'Resource Allocation & Workload', desc: 'Monitor team capacity to prevent over-utilization and burn-out.' },
  { Icon: Clock, title: 'Weekly & Monthly Timesheets', desc: 'Aggregated time reporting, exportable timesheets, and hour logs.' },
  { Icon: DollarSign, title: 'Budgeting & Cost Management', desc: 'Track project budget, expense approvals, and burn rate.' },
  { Icon: ShieldAlert, title: 'Risk Management Matrix', desc: '5x5 Risk register, likelihood & impact scoring, and mitigation plans.' },
  { Icon: Zap, title: 'Unlimited Automations & Subtasks', desc: 'Automate repetitive flows without limits or constraints.' },
];
const COMPARISON = [
  { label: 'Subtasks per task', free: '3', premium: 'Unlimited' },
  { label: 'Milestones per project', free: '2', premium: 'Unlimited' },
  { label: 'Max file upload size', free: '10 MB', premium: '1 GB' },
  { label: 'Gantt & Workload Views', free: '✕', premium: 'Included' },
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
            Elevate your project execution from basic task tracking to enterprise-grade planning, Gantt timelines, budgeting, and risk management.
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
