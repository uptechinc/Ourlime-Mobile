import { appServerService } from './AppServerService';
import type {
	ChildSafetyCaseActionInput,
	ChildSafetyMessage,
	ChildSafetyMessagePage,
	ChildSafetyPriority,
	ChildSafetyReportInput,
	ChildSafetyReportRecord,
	ChildSafetyStatus,
	ChildSafetyValidationDraft,
	ChildSafetyValidationResult,
	ReportedAccountReference,
} from '@/lib/types/childSafety';

type ReportPage = {
	items: ChildSafetyReportRecord[];
	hasMore: boolean;
	nextCursor: string | null;
};

/** Child-safety reports and the restricted reviewer queue, through the app's own server functions. */
export class ChildSafetyReportService {
	private static instance: ChildSafetyReportService;

	private constructor() {}

	public static getInstance(): ChildSafetyReportService {
		if (!ChildSafetyReportService.instance)
			ChildSafetyReportService.instance = new ChildSafetyReportService();
		return ChildSafetyReportService.instance;
	}

	public validate(draft: ChildSafetyValidationDraft): ChildSafetyValidationResult {
		if (!draft.category) return { valid: false, step: 1, field: 'category', message: 'Choose the category that best describes the concern.' };
		if (draft.description.trim().length < 20) return { valid: false, step: 3, field: 'description', message: 'Describe the concern in at least 20 characters.' };
		if (draft.hasAttachments && !draft.evidenceAcknowledged) return { valid: false, step: 4, field: 'evidence', message: 'Confirm that the selected images do not contain suspected CSAM.' };
		if (!draft.goodFaithAcknowledged) return { valid: false, step: 4, field: 'good_faith', message: 'Confirm that this report is accurate and submitted in good faith.' };
		return { valid: true };
	}

	public async submit(input: ChildSafetyReportInput): Promise<ChildSafetyReportRecord> {
		if (input.description.trim().length < 20)
			throw new Error('Describe the concern in at least 20 characters.');
		if (!input.goodFaithAcknowledged)
			throw new Error('Confirm that this report is being submitted in good faith.');
		return appServerService.call<ChildSafetyReportRecord>('submitChildSafetyReport', input, 20_000);
	}

	public async listCases(
		filters: {
			status?: ChildSafetyStatus;
			priority?: ChildSafetyPriority;
			assignedReviewerId?: string;
			cursor?: string;
		} = {}
	): Promise<ReportPage> {
		const result = await appServerService.call<{ page: ReportPage }>('listChildSafetyCases', filters);
		return result.page;
	}

	public listMyReports(cursor?: string): Promise<ReportPage> {
		return appServerService.call<ReportPage>('listMyChildSafetyReports', cursor ? { cursor } : {});
	}

	public getMyReport(reportId: string): Promise<ChildSafetyReportRecord> {
		return appServerService.call<ChildSafetyReportRecord>('getMyChildSafetyReport', { reportId });
	}

	public setReporterContact(reportId: string, allowContact: boolean): Promise<ChildSafetyReportRecord> {
		return appServerService.call<ChildSafetyReportRecord>('setChildSafetyReportContact', { reportId, allowContact });
	}

	public listMessages(reportId: string, reviewerMode = false): Promise<ChildSafetyMessagePage> {
		return appServerService.call<ChildSafetyMessagePage>('listChildSafetyMessages', { reportId, reviewerView: reviewerMode });
	}

	public sendMessage(reportId: string, text: string, attachmentIds: string[] = [], reviewerMode = false): Promise<ChildSafetyMessage> {
		return appServerService.call<ChildSafetyMessage>('sendChildSafetyMessage', { reportId, text, attachmentIds, reviewerView: reviewerMode });
	}

	public searchReportedAccounts(query: string): Promise<ReportedAccountReference[]> {
		return appServerService.call<ReportedAccountReference[]>('searchChildSafetyAccounts', { query });
	}

	public getCase(reportId: string): Promise<ChildSafetyReportRecord> {
		return appServerService.call<ChildSafetyReportRecord>('getChildSafetyCase', { reportId });
	}

	public async applyAction(reportId: string, input: ChildSafetyCaseActionInput): Promise<ChildSafetyReportRecord | null> {
		const result = await appServerService.call<{ report: ChildSafetyReportRecord | null }>('updateChildSafetyCase', { ...input, reportId });
		return result.report;
	}
}

export const childSafetyReportService = ChildSafetyReportService.getInstance();
