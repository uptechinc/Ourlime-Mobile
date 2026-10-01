import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebaseConfig';
import { appServerService } from './AppServerService';
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
export type SupportImageDraft = {
	uri: string;
	fileName: string;
	mediaType: string;
	byteSize: number;
};

/**
 * Support tickets through the app's own server functions. Signed-in users are identified by their sign-in;
 * a verified guest sends the session token saved after opening the email link.
 */
export class SupportTicketService {
	private static instance: SupportTicketService;
	private readonly cacheService = LocalCacheService.getInstance();
	private constructor() {}
	public static getInstance(): SupportTicketService {
		if (!SupportTicketService.instance)
			SupportTicketService.instance = new SupportTicketService();
		return SupportTicketService.instance;
	}

	public create(
		input: SupportTicketCreateInput
	): Promise<SupportTicket | { ticketId: string; verificationRequired: true }> {
		return appServerService.call('createSupportTicket', input);
	}
	public async verifyGuest(token: string): Promise<string> {
		const result = await appServerService.call<{ ticketId: string; sessionToken: string }>('verifySupportGuest', { token });
		await AsyncStorage.setItem(GUEST_TOKEN_KEY, result.sessionToken);
		return result.ticketId;
	}
	public async list(cursor?: string): Promise<SupportTicketPage> {
		return appServerService.call<SupportTicketPage>('listSupportTickets', { ...(await this.identity()), ...(cursor ? { cursor } : {}) });
	}
	public listStaff(filter: SupportTicketFilter): Promise<SupportTicketPage> {
		return appServerService.call<SupportTicketPage>('listStaffSupportTickets', { filter });
	}
	public async get(ticketId: string): Promise<SupportTicket> {
		return appServerService.call<SupportTicket>('getSupportTicket', { ...(await this.identity()), ticketId });
	}
	public async listMessages(ticketId: string, cursor?: string): Promise<SupportMessagePage> {
		return appServerService.call<SupportMessagePage>('listSupportMessages', { ...(await this.identity()), ticketId, ...(cursor ? { cursor } : {}) });
	}
	public async sendMessage(ticketId: string, text: string, attachmentIds: string[] = []): Promise<SupportTicketMessage> {
		return appServerService.call<SupportTicketMessage>('sendSupportMessage', { ...(await this.identity()), ticketId, text, attachmentIds });
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
			throw new Error('Select up to five images, 10 MB each and 25 MB combined.');
		const identity = await this.identity();
		const attachmentIds: string[] = [];
		for (const image of images) {
			const intent = await appServerService.call<{ uploadToken: string; uploadUrl: string }>('createCaseUploadIntent', {
				...identity,
				caseKind,
				caseId: ticketId,
				fileName: image.fileName,
				mediaType: image.mediaType,
				byteSize: image.byteSize,
				evidenceContainsNoSuspectedCsam,
			});
			const blob = await (await fetch(image.uri)).blob();
			const uploadResponse = await fetch(appServerService.functionUrl(intent.uploadUrl), {
				method: 'POST',
				headers: { 'Content-Type': image.mediaType, 'x-upload-token': intent.uploadToken },
				body: blob,
			});
			const upload = (await uploadResponse.json()) as { success: boolean; data?: { uploadId: string }; error?: string };
			if (!uploadResponse.ok || !upload.success || !upload.data)
				throw new Error(upload.error || 'Image upload failed.');
			await appServerService.call('finalizeCaseUpload', { ...identity, uploadToken: intent.uploadToken, uploadId: upload.data.uploadId });
			attachmentIds.push(upload.data.uploadId);
		}
		return attachmentIds;
	}
	public async applyAction(ticketId: string, input: SupportTicketActionInput): Promise<SupportTicket> {
		return appServerService.call<SupportTicket>('updateSupportTicket', { ...(await this.identity()), ...input, ticketId });
	}
	public async getAttachmentPreviewUrl(uploadId: string): Promise<string> {
		const result = await appServerService.call<{ url: string }>('getCaseAttachmentPreview', { ...(await this.identity()), uploadId });
		return result.url;
	}
	public async readCachedList(userId: string): Promise<SupportTicketPage | null> {
		return (await this.cacheService.read<SupportTicketPage>(userId, CACHE_NAMESPACE, 'list'))?.data ?? null;
	}
	public async cacheList(userId: string, page: SupportTicketPage): Promise<void> {
		await this.cacheService.write(userId, CACHE_NAMESPACE, 'list', page, { expiresAt: Date.now() + CACHE_RETENTION_MS });
	}
	public async readCachedConversation(userId: string, ticketId: string): Promise<SupportMessagePage | null> {
		return (await this.cacheService.read<SupportMessagePage>(userId, CACHE_NAMESPACE, `conversation:${ticketId}`))?.data ?? null;
	}
	public async cacheConversation(userId: string, ticketId: string, page: SupportMessagePage): Promise<void> {
		await this.cacheService.write(userId, CACHE_NAMESPACE, `conversation:${ticketId}`, { ...page, items: page.items.slice(-30) }, { expiresAt: Date.now() + CACHE_RETENTION_MS });
	}
	public async getCacheOwnerId(): Promise<string> {
		return auth.currentUser?.uid || `guest:${(await AsyncStorage.getItem(GUEST_TOKEN_KEY))?.slice(0, 12) || 'unverified'}`;
	}

	/** Signed-in calls need nothing extra; a guest sends the saved support session token. */
	private async identity(): Promise<{ guestToken?: string }> {
		if (auth.currentUser) return {};
		const token = await AsyncStorage.getItem(GUEST_TOKEN_KEY);
		return token ? { guestToken: token } : {};
	}
}

export const supportTicketService = SupportTicketService.getInstance();
