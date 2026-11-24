import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Award } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { ProjectSection } from '@/components/projectManagement/ProjectUiParts';
import { formatWhen } from '@/components/projectManagement/ProjectFormParts';
import { projectOperationsService } from '@/lib/services/ProjectOperationsService';
import type { ProjectOutcome } from '@/lib/types/project';

type ProjectOutcomeCardProps = { projectId: string; outcomeId: string; nameOf: (uid: string) => string };

/** The outcome recorded when the project was completed: summary, who benefited, results, lessons and accepted deliverables. */
export default function ProjectOutcomeCard({ projectId, outcomeId, nameOf }: ProjectOutcomeCardProps) {
  const { colors } = useAppTheme();
  const [outcome, setOutcome] = useState<ProjectOutcome | null>(null);

  useEffect(() => {
    let active = true;
    projectOperationsService.outcome(projectId, outcomeId)
      .then((value) => { if (active) setOutcome(value); })
      .catch((error: unknown) => console.error('[ProjectOutcomeCard.load] Error:', error));
    return () => { active = false; };
  }, [outcomeId, projectId]);

  if (!outcome) return null;
  const block = (label: string, value: string) => (value ? <View style={{ gap: 2 }}>
    <Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{value}</Text>
  </View> : null);
  return (
    <ProjectSection title="Outcome" icon={<Award size={18} color={colors.accent} />}>
      {block('Summary', outcome.summary || 'No summary was written when the project was completed.')}
      {block('Who benefited', outcome.beneficiaries)}
      {block('Results', outcome.results)}
      {block('Lessons learned', outcome.lessons)}
      {outcome.acceptedDeliverables.length > 0 ? block('Accepted deliverables', outcome.acceptedDeliverables.map((deliverable) => deliverable.title).join(', ')) : null}
      <Text style={{ color: colors.mutedText, fontSize: 12 }}>Recorded by {nameOf(outcome.recordedBy)}{outcome.recordedAt ? `, ${formatWhen(outcome.recordedAt)}` : ''}. Visible to project members only. Nothing is published.</Text>
    </ProjectSection>
  );
}
