import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { ProjectButton, ProjectPill, ProjectSection } from '@/components/projectManagement/ProjectUiParts';
import { ProjectListRow, formatWhen, projectListStyle } from '@/components/projectManagement/ProjectFormParts';
import { projectOperationsService } from '@/lib/services/ProjectOperationsService';
import { projectReviewHref } from '@/components/projectManagement/projectReviewRoute';
import type { ProjectStakeholder } from '@/lib/types/project';

type ProjectReviewAccessSectionProps = { refreshKey: number; canRespond: boolean };

/**
 * On the projects page: invitations to review someone else's project as a client or reviewer, and the projects you
 * already review (website ProjectReviewAccessSection). Hidden when there are none.
 */
export default function ProjectReviewAccessSection({ refreshKey, canRespond }: ProjectReviewAccessSectionProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [records, setRecords] = useState<ProjectStakeholder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRecords(await projectOperationsService.myReviewAccess());
    } catch (error: unknown) {
      console.error('[ProjectReviewAccessSection.load] Error:', error);
    }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const respond = async (record: ProjectStakeholder, decision: 'accept' | 'decline'): Promise<void> => {
    if (busyId) return;
    setBusyId(record.id);
    try {
      await projectOperationsService.respondToReview(record.projectId, decision);
      toast.success(decision === 'accept' ? 'Invitation accepted' : 'Invitation declined');
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'That did not work. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  if (records.length === 0) return null;
  const pending = records.filter((record) => record.status === 'pending');
  const accepted = records.filter((record) => record.status === 'accepted');
  const open = (record: ProjectStakeholder): void => router.push(projectReviewHref(record.projectId));

  return (
    <View style={{ gap: 12 }}>
      {pending.length > 0 ? (
        <ProjectSection title={`Review invitations (${pending.length})`} icon={<Eye size={18} color={colors.accent} />}>
          <Text style={{ color: colors.mutedText, fontSize: 12 }}>You would see only the work the team shares with you.</Text>
          {pending.map((record) => {
            const expired = record.expiresAt !== null && record.expiresAt.getTime() <= Date.now();
            return (
              <View key={record.id} style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{record.projectName}</Text>
                <Text style={{ color: colors.mutedText, fontSize: 12 }}>As a {record.role}{record.expiresAt ? ` · ${expired ? 'expired' : `expires ${formatWhen(record.expiresAt)}`}` : ''}</Text>
                {expired ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>Ask the project owner to send it again.</Text> : (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <ProjectButton isCompact variant="secondary" label="Decline" isDisabled={!canRespond || busyId !== null} onPress={() => void respond(record, 'decline')} style={{ flex: 1 }} accessibilityLabel={`Decline the review invitation to ${record.projectName}`} />
                    <ProjectButton isCompact label="Accept" isBusy={busyId === record.id} isDisabled={!canRespond || busyId !== null} onPress={() => void respond(record, 'accept')} style={{ flex: 1 }} accessibilityLabel={`Accept the review invitation to ${record.projectName}`} />
                  </View>
                )}
              </View>
            );
          })}
        </ProjectSection>
      ) : null}
      {accepted.length > 0 ? (
        <ProjectSection title={`Projects you review (${accepted.length})`} icon={<Eye size={18} color={colors.accent} />}>
          <View style={projectListStyle(colors)}>
            {accepted.map((record, index) => (
              <ProjectListRow key={record.id} isFirst={index === 0} title={record.projectName} detail={`You are a ${record.role}`} onPress={() => open(record)} accessibilityLabel={`Open ${record.projectName}, shared with you as a ${record.role}`} right={<ProjectPill label={record.role === 'client' ? 'Client' : 'Reviewer'} tone="info" />} />
            ))}
          </View>
        </ProjectSection>
      ) : null}
    </View>
  );
}
