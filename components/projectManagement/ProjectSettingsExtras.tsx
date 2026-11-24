import { useState } from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle, Flag, Users } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { projectLifecycleRules } from '@/lib/services/ProjectLifecycleRules';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import CustomModal from '@/components/ui/CustomModal';
import { ProjectButton } from '@/components/projectManagement/ProjectUiParts';
import ProjectModulesSection from '@/components/projectManagement/ProjectModulesSection';
import type { ProjectRecord } from '@/lib/types/project';

type ProjectSettingsExtrasProps = {
  project: ProjectRecord;
  onDelete: () => Promise<void>;
  /** Called after a module is switched on or off, so the screen reloads the project. */
  onModulesChanged: () => void;
};

/**
 * Under the project details form: where status and team changes live now, and the owner's danger zone. Team roles
 * moved to the project's Team tab; status changes to the ⋯ menu (a recorded server transition).
 */
export default function ProjectSettingsExtras({ project, onDelete, onModulesChanged }: ProjectSettingsExtrasProps) {
  const { colors } = useAppTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canManage = project.role === 'owner' || project.role === 'admin';
  const isOwner = project.role === 'owner';

  const handleDelete = async (): Promise<void> => {
    if (deleting) return;
    setDeleting(true);
    try { await onDelete(); toast.success('Project deleted'); }
    catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'The project could not be deleted.'); }
    finally { setDeleting(false); setConfirmOpen(false); }
  };

  const card = { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 10 } as const;

  return (
    <View style={{ gap: 14, marginTop: 4 }}>
      {canManage ? (
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Flag size={16} color={colors.accentText} /><Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>Status: {projectLifecycleRules.label(project.status)}</Text></View>
          <Text style={{ color: colors.mutedText, fontSize: 13, lineHeight: 18 }}>Pause, complete, archive or restore the project from the ⋯ menu at the top of the project.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Users size={16} color={colors.accentText} /><Text style={{ color: colors.mutedText, fontSize: 13, flex: 1 }}>Invite people and change roles on the project&apos;s Team tab.</Text></View>
        </View>
      ) : null}

      <ProjectModulesSection projectId={project.id} modules={project.modules} canManage={canManage} onChanged={onModulesChanged} />

      {isOwner ? (
        <View style={[card, { borderColor: colors.destructiveText }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} color={colors.destructive} /><Text style={{ color: colors.destructiveText, fontSize: 15, fontWeight: '800' }}>Delete project</Text></View>
          <Text style={{ color: colors.mutedText, fontSize: 13, lineHeight: 18 }}>Removes the project and its tasks for everyone. To keep a record instead, archive it from the ⋯ menu.</Text>
          <ProjectButton label="Delete project" variant="danger" isBusy={deleting} onPress={() => setConfirmOpen(true)} />
        </View>
      ) : null}

      <CustomModal
        visible={confirmOpen}
        type="danger"
        title="Delete project?"
        message={`${project.name} and all of its tasks will be removed for every member.`}
        confirmText="Delete"
        cancelText="Keep"
        isLoading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmOpen(false)}
        onClose={() => setConfirmOpen(false)}
      />
    </View>
  );
}
