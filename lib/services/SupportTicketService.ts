import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebaseConfig';
import { ApiService } from './ApiService';
import { LocalCacheService } from './LocalCacheService';
import type {
	SupportMessagePage,
	SupportTicket,
	SupportTicketActionInput,
	SupportTicketCreateInput,
	SupportTicketFilter,
	SupportTicketMessage,
	SupportTicketPage,
} from '@/lib/types/support';

const GUEST_TOKEN_KEY = 'ourlime.support.guest-session';
const CACHE_NAMESPACE = 'support-tickets';
const CACHE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
type ItemResponse<TItem> = { success: boolean; data?: TItem; error?: string };
export type SupportImageDraft = {
	uri: string;
	fileName: string;
	mediaType: string;
	byteSize: number;
};

export class SupportTicketService {
	private static instance: SupportTicketService;
	private readonly apiService = ApiService.getInstance();
	private readonly cacheService = LocalCacheService.getInstance();
	private constructor() {}
	public static getInstance(): SupportTicketService {
		if (!SupportTicketService.instance)
			SupportTicketService.instance = new SupportTicketService();
		return SupportTicketService.instance;
	}

	public async create(
		input: SupportTicketCreateInput
	): Promise<SupportTicket | { ticketId: string; verificationRequired: true }> {
		const response = await this.apiService.request<
			ItemResponse<
				SupportTicket | { ticketId: string; verificationRequired: true }
			>
		>('/api/support/tickets', {
			method: 'POST',
			authenticated: Boolean(auth.currentUser),
			body: input,
		});
		if (!response.success || !response.data)
			throw new Error(
				response.error || 'The support ticket could not be opened.'
			);
		return response.data;
	}
	public async verifyGuest(token: string): Promise<string> {
		const response = await this.apiService.request<
			ItemResponse<{ ticketId: string; sessionToken: string }>
		>('/api/support/guest/verify', { method: 'POST', body: { token } });
		if (!response.success || !response.data)
			throw new Error(
				response.error || 'The support link is invalid or expired.'
			);
		await AsyncStorage.setItem(GUEST_TOKEN_KEY, response.data.sessionToken);
		return response.data.ticketId;
	}
	public async list(cursor?: string): Promise<SupportTicketPage> {
		const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
		const response = await this.apiService.request<
			ItemResponse<SupportTicketPage>
		>(`/api/support/tickets${query}`, await this.requestOptions());
		if (!response.success || !response.data)
			throw new Error(response.error || 'Support tickets could not be loaded.');
		return response.data;
	}
	public async listStaff(
		filter: SupportTicketFilter
	): Promise<SupportTicketPage> {
		const response = await this.apiService.request<
			ItemResponse<SupportTicketPage>
		>(`/api/admin/support/tickets?filter=${filter}`, { authenticated: true });
		if (!response.success || !response.data)
			throw new Error(response.error || 'Support queue could not be loaded.');
		return response.data;
	}
	public async get(ticketId: string): Promise<SupportTicket> {
		const response = await this.apiService.request<ItemResponse<SupportTicket>>(
			`/api/support/tickets/${encodeURIComponent(ticketId)}`,
			await this.requestOptions()
		);
		if (!response.success || !response.data)
			throw new Error(response.error || 'Support ticket could not be loaded.');
		return response.data;
	}
	public async listMessages(
		ticketId: string,
		cursor?: string
	): Promise<SupportMessagePage> {
		const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
		const response = await this.apiService.request<
			ItemResponse<SupportMessagePage>
		>(
			`/api/support/tickets/${encodeURIComponent(ticketId)}/messages${query}`,
			await this.requestOptions()
		);
		if (!response.success || !response.data)
			throw new Error(response.error || 'Ticket messages could not be loaded.');
		return response.data;
	}
	public async sendMessage(
		ticketId: string,
		text: string,
		attachmentIds: string[] = []
	): Promise<SupportTicketMessage> {
		const options = await this.requestOptions();
		const response = await this.apiService.request<
			ItemResponse<SupportTicketMessage>
		>(`/api/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
			...options,
			method: 'POST',
			body: { text, attachmentIds },
		});
		if (!response.success || !response.data)
			throw new Error(response.error || 'Ticket message could not be sent.');
		return response.data;
	}
	public async uploadImages(
		ticketId: string,
		images: SupportImageDraft[],
		caseKind: 'support' | 'child_safety' = 'support',
		evidenceContainsNoSuspectedCsam = true
	): Promise<string[]> {
		if (
			images.length > 5 ||
			images.some((image) => image.byteSize > 10 * 1024 * 1024) ||
			images.reduce((sum, image) => sum + image.byteSize, 0) > 25 * 1024 * 1024
		)
			throw new Error(
				'Select up to five images, 10 MB each and 25 MB combined.'
			);
		const options = await this.requestOptions();
		const attachmentIds: string[] = [];
		for (const image of images) {
			const intent = await this.apiService.request<
				ItemResponse<{ uploadToken: string; uploadUrl: string }>
			>('/api/case-attachments/intents', {
				...options,
				method: 'POST',
				body: {
					caseKind,
					caseId: ticketId,
					fileName: image.fileName,
					mediaType: image.mediaType,
					byteSize: image.byteSize,
					evidenceContainsNoSuspectedCsam,
				},
			});
			if (!intent.success || !intent.data)
				throw new Error(intent.error || 'Image upload could not start.');
			const imageResponse = await fetch(image.uri);
			const blob = await imageResponse.blob();
			const uploadResponse = await fetch(
				`${this.apiService.getBaseUrl()}${intent.data.uploadUrl}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': image.mediaType,
						'x-upload-token': intent.data.uploadToken,
					},
					body: blob,
				}
			);
			const upload = (await uploadResponse.json()) as ItemResponse<{
				uploadId: string;
			}>;
			if (!uploadResponse.ok || !upload.success || !upload.data)
				throw new Error(upload.error || 'Image upload failed.');
			const finalized = await this.apiService.request<ItemResponse<unknown>>(
				'/api/case-attachments/finalize',
				{
					...options,
					method: 'POST',
					body: {
						uploadToken: intent.data.uploadToken,
						uploadId: upload.data.uploadId,
					},
				}
			);
			if (!finalized.success)
				throw new Error(
					finalized.error || 'Image upload could not be finalized.'
				);
			attachmentIds.push(upload.data.uploadId);
		}
		return attachmentIds;
	}
	public async applyAction(
		ticketId: string,
		input: SupportTicketActionInput
	): Promise<SupportTicket> {
		const options = await this.requestOptions();
		const response = await this.apiService.request<ItemResponse<SupportTicket>>(
			`/api/support/tickets/${encodeURIComponent(ticketId)}`,
			{ ...options, method: 'PATCH', body: input }
		);
		if (!response.success || !response.data)
			throw new Error(response.error || 'Support ticket could not be updated.');
		return response.data;
	}
	public async getAttachmentPreviewUrl(uploadId: string): Promise<string> {
		const response = await this.apiService.request<
			ItemResponse<{ url: string }>
		>(
			`/api/case-attachments/${encodeURIComponent(uploadId)}/preview`,
			await this.requestOptions()
		);
		if (!response.success || !response.data?.url) {
			throw new Error(
				response.error || 'The private image preview could not be loaded.'
			);
		}
		return response.data.url;
	}
	public async readCachedList(
		userId: string
	): Promise<SupportTicketPage | null> {
		return (
			(
				await this.cacheService.read<SupportTicketPage>(
					userId,
					CACHE_NAMESPACE,
					'list'
				)
			)?.data ?? null
		);
	}
	public async cacheList(
		userId: string,
		page: SupportTicketPage
	): Promise<void> {
		await this.cacheService.write(userId, CACHE_NAMESPACE, 'list', page, {
			expiresAt: Date.now() + CACHE_RETENTION_MS,
		});
	}
	public async readCachedConversation(
		userId: string,
		ticketId: string
	): Promise<SupportMessagePage | null> {
		return (
			(
				await this.cacheService.read<SupportMessagePage>(
					userId,
					CACHE_NAMESPACE,
					`conversation:${ticketId}`
				)
			)?.data ?? null
		);
	}
	public async cacheConversation(
		userId: string,
		ticketId: string,
		page: SupportMessagePage
	): Promise<void> {
		await this.cacheService.write(
			userId,
			CACHE_NAMESPACE,
			`conversation:${ticketId}`,
			{ ...page, items: page.items.slice(-30) },
			{ expiresAt: Date.now() + CACHE_RETENTION_MS }
		);
	}
	public async getCacheOwnerId(): Promise<string> {
		return (
			auth.currentUser?.uid ||
			`guest:${(await AsyncStorage.getItem(GUEST_TOKEN_KEY))?.slice(0, 12) || 'unverified'}`
		);
	}
	public getApiBaseUrl(): string {
		return this.apiService.getBaseUrl();
	}
	public async getAuthorizationHeader(): Promise<string | null> {
		if (auth.currentUser)
			return `Bearer ${await auth.currentUser.getIdToken()}`;
		const token = await AsyncStorage.getItem(GUEST_TOKEN_KEY);
		return token ? `SupportGuest ${token}` : null;
	}

	private async requestOptions(): Promise<{
		authenticated: boolean;
		headers?: { Authorization: string };
	}> {
		if (auth.currentUser) return { authenticated: true };
		const token = await AsyncStorage.getItem(GUEST_TOKEN_KEY);
		return token
			? {
					authenticated: false,
					headers: { Authorization: `SupportGuest ${token}` },
				}
			: { authenticated: false };
	}
}
export const supportTicketService = SupportTicketService.getInstance();
