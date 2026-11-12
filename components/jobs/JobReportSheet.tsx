import { toast } from 'sonner-native';
import CommunityReportModal from '@/components/communities/CommunityReportModal';
import { moderationService } from '@/lib/services/ModerationService';
import type { JobRecord } from '@/lib/job/JobsService';

type JobReportSheetProps = {
  job: JobRecord | null;
  onClose: () => void;
};

/**
 * "Report listing" from the job details (web ReportModal with contentType 'job'). The app's moderation service has
 * no 'job' content type yet, so the report is filed as 'other' with the job's route, which moderators can open.
 */
export default function JobReportSheet({ job, onClose }: JobReportSheetProps) {
  return (
    <CommunityReportModal
      visible={job !== null}
      title="Report listing"
      subjectLabel={job ? `${job.basic_info.title} - ${job.basic_info.description}`.slice(0, 160) : ''}
      onClose={onClose}
      onSubmit={async (category, reason, details, childSafety) => {
        if (!job) return;
        await moderationService.reportContent('job', {
          targetId: job.id,
          reportedUserId: job.basic_info.userId,
          reasonCategory: category,
          reason,
          description: details,
          routePath: `/jobs?job=${job.id}`,
          immediateDanger: childSafety?.immediateDanger,
          goodFaithAcknowledged: childSafety?.goodFaithAcknowledged,
          allowContact: childSafety?.allowContact,
        });
        toast.success('Your report was sent to the Ourlime moderation team.');
      }}
      childSafetyTarget={job ? { type: 'other', id: job.id, ownerUserId: job.basic_info.userId, routePath: `/jobs?job=${job.id}` } : undefined}
    />
  );
}
