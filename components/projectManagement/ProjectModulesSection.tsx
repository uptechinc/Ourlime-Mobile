import { useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
import { toast } from 'sonner-native';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { ProjectSection } from '@/components/projectManagement/ProjectUiParts';
import { PROJECT_MODULE_COPY, PROJECT_MODULE_IDS, type ProjectModuleId } from '@/lib/services/ProjectModuleRules';
import { projectOperationsService } from '@/lib/services/ProjectOperationsService';
import type { ProjectModuleFlags } from '@/lib/types/project';

type ProjectModulesSectionProps = { projectId: string; modules: ProjectModuleFlags; canManage: boolean; onChanged: () => void };

/**
 * Optional modules in project settings (website ProjectModulesSection). Owners and admins switch them on per project so a
 * simple project stays simple; switching one off hides it and keeps its data.
 */
export default function ProjectModulesSection({ projectId, modules, canManage, onChanged }: ProjectModulesSectionProps) {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState<ProjectModuleId | null>(null);
  const [confirmOff, setConfirmOff] = useState<ProjectModuleId | null>(null);

  const save = async (id: ProjectModuleId, enabled: boolean): Promise<void> => {
    setBusy(id);
    try {
      await projectOperationsService.updateModules(projectId, { [id]: enabled });
      toast.success(`${PROJECT_MODULE_COPY[id].label} ${enabled ? 'switched on' : 'switched off'}`);
      onChanged();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'The module could not be changed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ProjectSection title="Modules">
      <Text style={{ color: colors.mutedText, fontSize: 12, lineHeight: 17 }}>{canManage ? 'Switch on only what this project needs.' : 'Only the project owner or an admin can change modules.'}</Text>
      {PROJECT_MODULE_IDS.map((id) => (
        <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{PROJECT_MODULE_COPY[id].label}</Text>
            <Text style={{ color: colors.mutedText, fontSize: 12, lineHeight: 17 }}>{PROJECT_MODULE_COPY[id].description}</Text>
          </View>
          {busy === id ? <ActivityIndicator color={colors.accent} /> : (
            <Switch
              value={modules[id]}
              disabled={!canManage || busy !== null}
              onValueChange={(enabled) => { if (enabled) void save(id, true); else setConfirmOff(id); }}
              accessibilityLabel={PROJECT_MODULE_COPY[id].label}
            />
          )}
        </View>
      ))}
      <CustomModal
        visible={confirmOff !== null}
        type="warning"
        title={`Switch off ${confirmOff ? PROJECT_MODULE_COPY[confirmOff].label.toLowerCase() : ''}?`}
        message="It disappears from this project for everyone. Its records are kept and come back if you switch it on again."
        confirmText="Switch off"
        cancelText="Keep on"
        onConfirm={() => { const id = confirmOff; setConfirmOff(null); if (id) void save(id, false); }}
        onCancel={() => setConfirmOff(null)}
        onClose={() => setConfirmOff(null)}
      />
    </ProjectSection>
  );
}
