import { ApiService } from './ApiService';
import type {
	ChildSafetyCaseActionInput,
	ChildSafetyMessage,
	ChildSafetyMessagePage,
	ChildSafetyPriority,
	ChildSafetyReportInput,
	ChildSafetyReportRecord,
	ChildSafetyStatus,
	ReportedAccountReference,
} from '@/lib/types/childSafety';

type ItemResponse = {
	success: boolean;
	data?: ChildSafetyReportRecord | null;
	error?: string;
};
type PageResponse = {
	success: boolean;
	data?: {
		items: ChildSafetyReportRecord[];
		hasMore: boolean;
		nextCursor: string | null;
	};
	error?: string;
};

export class ChildSafetyReportService {
	private static instance: ChildSafetyReportService;
	private readonly apiService = ApiService.getInstance();

	private constructor() {}

	public static getInstance(): ChildSafetyReportService {
		if (!ChildSafetyReportService.instance)
			ChildSafetyReportService.instance = new ChildSafetyReportService();
		return ChildSafetyReportService.instance;
	}

	public async submit(
		input: ChildSafetyReportInput
	): Promise<ChildSafetyReportRecord> {
		if (input.description.trim().length < 20)
			throw new Error('Describe the concern in at least 20 characters.');
		if (!input.goodFaithAcknowledged)
			throw new Error(
				'Confirm that this report is being submitted in good faith.'
			);
		const response = await this.apiService.request<ItemResponse>(
			'/api/child-safety/reports',
			{
				method: 'POST',
				authenticated: true,
				body: input,
				timeoutMs: 20_000,
			}
		);
		if (!response.success || !response.data)
			throw new Error(
				response.error || 'The child-safety report could not be submitted.'
			);
		return response.data;
	}

	public async listCases(
		filters: {
			status?: ChildSafetyStatus;
			priority?: ChildSafetyPriority;
			assignedReviewerId?: string;
			cursor?: string;
		} = {}
	): Promise<{
		items: ChildSafetyReportRecord[];
		hasMore: boolean;
		nextCursor: string | null;
	}> {
		const parameters = [
			filters.status ? `status=${encodeURIComponent(filters.status)}` : '',
			filters.priority
				? `priority=${encodeURIComponent(filters.priority)}`
				: '',
			filters.assignedReviewerId
				? `assignedReviewerId=${encodeURIComponent(filters.assignedReviewerId)}`
				: '',
			filters.cursor ? `cursor=${encodeURIComponent(filters.cursor)}` : '',
		]
			.filter(Boolean)
			.join('&');
		const response = await this.apiService.request<PageResponse>(
			`/api/admin/child-safety/reports${parameters ? `?${parameters}` : ''}`,
			{ authenticated: true }
		);
		if (!response.success || !response.data)
			throw new Error(
				response.error || 'Restricted cases could not be loaded.'
			);
		return response.data;
	}

	public async listMyReports(cursor?: string): Promise<{
		items: ChildSafetyReportRecord[];
		hasMore: boolean;
		nextCursor: string | null;
	}> {
		const response = await this.apiService.request<PageResponse>(
			`/api/child-safety/reports${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
			{ authenticated: true }
		);
		if (!response.success || !response.data)
			throw new Error(response.error || 'Safety reports could not be loaded.');
		return response.data;
	}

	public async getMyReport(reportId: string): Promise<ChildSafetyReportRecord> {
		const response = await this.apiService.request<ItemResponse>(
			`/api/child-safety/reports/${encodeURIComponent(reportId)}`,
			{ authenticated: true }
		);
		if (!response.success || !response.data)
			throw new Error(response.error || 'Safety report could not be loaded.');
		return response.data;
	}

	public async setReporterContact(
		reportId: string,
		allowContact: boolean
	): Promise<ChildSafetyReportRecord> {
		const response = await this.apiService.request<ItemResponse>(
			`/api/child-safety/reports/${encodeURIComponent(reportId)}`,
			{ method: 'PATCH', authenticated: true, body: { allowContact } }
		);
		if (!response.success || !response.data)
			throw new Error(
				response.error || 'Contact preference could not be updated.'
			);
		return response.data;
	}

	public async listMessages(
		reportId: string,
		reviewerMode = false
	): Promise<ChildSafetyMessagePage> {
		const prefix = reviewerMode
			? '/api/admin/child-safety/reports'
			: '/api/child-safety/reports';
		const response = await this.apiService.request<{
			success: boolean;
			data?: ChildSafetyMessagePage;
			error?: string;
		}>(`${prefix}/${encodeURIComponent(reportId)}/messages`, {
			authenticated: true,
		});
		if (!response.success || !response.data)
			throw new Error(
				response.error || 'Secure case messages could not be loaded.'
			);
		return response.data;
	}

	public async sendMessage(
		reportId: string,
		text: string,
		attachmentIds: string[] = [],
		reviewerMode = false
	): Promise<ChildSafetyMessage> {
		const prefix = reviewerMode
			? '/api/admin/child-safety/reports'
			: '/api/child-safety/reports';
		const response = await this.apiService.request<{
			success: boolean;
			data?: ChildSafetyMessage;
			error?: string;
		}>(`${prefix}/${encodeURIComponent(reportId)}/messages`, {
			method: 'POST',
			authenticated: true,
			body: { text, attachmentIds },
		});
		if (!response.success || !response.data)
			throw new Error(
				response.error || 'Secure case message could not be sent.'
			);
		return response.data;
	}

	public async searchReportedAccounts(
		query: string
	): Promise<ReportedAccountReference[]> {
		const response = await this.apiService.request<{
			success: boolean;
			data?: ReportedAccountReference[];
			error?: string;
		}>(`/api/child-safety/accounts/search?q=${encodeURIComponent(query)}`, {
			authenticated: true,
		});
		if (!response.success)
			throw new Error(response.error || 'Accounts could not be searched.');
		return response.data ?? [];
	}

	public async getCase(reportId: string): Promise<ChildSafetyReportRecord> {
		const response = await this.apiService.request<ItemResponse>(
			`/api/admin/child-safety/reports/${encodeURIComponent(reportId)}`,
			{ authenticated: true }
		);
		if (!response.success || !response.data)
			throw new Error(response.error || 'Restricted case could not be loaded.');
		return response.data;
	}

	public async applyAction(
		reportId: string,
		input: ChildSafetyCaseActionInput
	): Promise<ChildSafetyReportRecord | null> {
		const response = await this.apiService.request<ItemResponse>(
			`/api/admin/child-safety/reports/${encodeURIComponent(reportId)}`,
			{
				method: 'PATCH',
				authenticated: true,
				body: input,
			}
		);
		if (!response.success)
			throw new Error(
				response.error || 'Restricted case could not be updated.'
			);
		return response.data ?? null;
	}
}

export const childSafetyReportService = ChildSafetyReportService.getInstance();
