import { SupportTicketService } from './SupportTicketService';
import { useSupportTicketStore } from '@/lib/store/useSupportTicketStore';
import type {
	SupportMessagePage,
	SupportTicketMessage,
	SupportTicketPage,
} from '@/lib/types/support';
import { ServiceResultError } from '@/lib/types/serviceResults';

export class SupportTicketResourceService {
	private static instance: SupportTicketResourceService;
	private readonly service = SupportTicketService.getInstance();
	private readonly inFlight = new Map<string, Promise<void>>();
	private constructor() {}
	public static getInstance(): SupportTicketResourceService {
		if (!SupportTicketResourceService.instance)
			SupportTicketResourceService.instance =
				new SupportTicketResourceService();
		return SupportTicketResourceService.instance;
	}

	public async hydrateList(): Promise<void> {
		const userId = await this.service.getCacheOwnerId();
		const cached = await this.service.readCachedList(userId);
		if (cached)
			useSupportTicketStore.getState().setTickets({
				data: cached,
				status: 'ready',
				source: 'disk',
				updatedAt: Date.now(),
				isStale: true,
				error: null,
			});
	}
	public async refreshList(): Promise<void> {
		if (this.inFlight.has('list')) return this.inFlight.get('list');
		const operation = (async () => {
			try {
				await this.fetchList();
			} finally {
				this.inFlight.delete('list');
			}
		})();
		this.inFlight.set('list', operation);
		return operation;
	}
	public async loadMoreList(): Promise<void> {
		const store = useSupportTicketStore.getState();
		const current = store.tickets.data;
		if (!current?.hasMore || !current.nextCursor) return;
		const page = await this.service.list(current.nextCursor);
		const unique = new Map(
			[...current.items, ...page.items].map(
				(ticket) => [ticket.id, ticket] as const
			)
		);
		const data: SupportTicketPage = { ...page, items: [...unique.values()] };
		const userId = await this.service.getCacheOwnerId();
		store.setTickets({
			data,
			status: 'ready',
			source: 'network',
			updatedAt: Date.now(),
			isStale: false,
			error: null,
		});
		await this.service.cacheList(userId, data);
	}
	public async hydrateConversation(ticketId: string): Promise<void> {
		const userId = await this.service.getCacheOwnerId();
		const cached = await this.service.readCachedConversation(userId, ticketId);
		if (cached)
			useSupportTicketStore.getState().setConversation(ticketId, {
				data: cached,
				status: 'ready',
				source: 'disk',
				updatedAt: Date.now(),
				isStale: true,
				error: null,
			});
	}
	public async refreshConversation(ticketId: string): Promise<void> {
		const key = `conversation:${ticketId}`;
		if (this.inFlight.has(key)) return this.inFlight.get(key);
		const operation = (async () => {
			try {
				await this.fetchConversation(ticketId);
			} finally {
				this.inFlight.delete(key);
			}
		})();
		this.inFlight.set(key, operation);
		return operation;
	}
	public async loadOlderConversation(ticketId: string): Promise<void> {
		const store = useSupportTicketStore.getState();
		const current = store.conversations[ticketId]?.data;
		if (!current?.hasMore || !current.nextCursor) return;
		const page = await this.service.listMessages(ticketId, current.nextCursor);
		const data: SupportMessagePage = {
			...page,
			items: this.merge([...page.items, ...current.items]),
		};
		const userId = await this.service.getCacheOwnerId();
		store.setConversation(ticketId, {
			data,
			status: 'ready',
			source: 'network',
			updatedAt: Date.now(),
			isStale: false,
			error: null,
		});
		await this.service.cacheConversation(userId, ticketId, data);
	}
	public async appendMessage(
		ticketId: string,
		message: SupportTicketMessage
	): Promise<void> {
		const current = useSupportTicketStore.getState().conversations[ticketId];
		const items = this.merge([...(current?.data?.items ?? []), message]);
		const data: SupportMessagePage = {
			items,
			nextCursor: current?.data?.nextCursor ?? null,
			hasMore: current?.data?.hasMore ?? false,
		};
		const userId = await this.service.getCacheOwnerId();
		useSupportTicketStore.getState().setConversation(ticketId, {
			data,
			status: 'ready',
			source: 'network',
			updatedAt: Date.now(),
			isStale: false,
			error: null,
		});
		await this.service.cacheConversation(userId, ticketId, data);
	}
	private async fetchList(): Promise<void> {
		const store = useSupportTicketStore.getState();
		store.setTickets({
			...store.tickets,
			status: store.tickets.data ? 'refreshing' : 'hydrating',
			error: null,
		});
		try {
			const data = await this.service.list();
			const userId = await this.service.getCacheOwnerId();
			store.setTickets({
				data,
				status: 'ready',
				source: 'network',
				updatedAt: Date.now(),
				isStale: false,
				error: null,
			});
			await this.service.cacheList(userId, data);
		} catch (error: unknown) {
			store.setTickets({
				...store.tickets,
				status: store.tickets.data ? 'ready' : 'error',
				isStale: true,
				error: new ServiceResultError(
					'network',
					error instanceof Error
						? error.message
						: 'Support tickets could not be loaded.',
					error
				),
			});
		}
	}
	private async fetchConversation(ticketId: string): Promise<void> {
		const store = useSupportTicketStore.getState();
		const current = store.conversations[ticketId];
		store.setConversation(ticketId, {
			data: current?.data ?? null,
			status: current?.data ? 'refreshing' : 'hydrating',
			source: current?.source ?? 'memory',
			updatedAt: current?.updatedAt ?? null,
			isStale: true,
			error: null,
		});
		try {
			const [ticket, page] = await Promise.all([
				this.service.get(ticketId),
				this.service.listMessages(ticketId),
			]);
			const data: SupportMessagePage = {
				items: this.merge([...(current?.data?.items ?? []), ...page.items]),
				nextCursor: current?.data?.nextCursor ?? page.nextCursor,
				hasMore: current?.data?.hasMore ?? page.hasMore,
			};
			const userId = await this.service.getCacheOwnerId();
			useSupportTicketStore.getState().setSelectedTicket(ticket);
			useSupportTicketStore.getState().setConversation(ticketId, {
				data,
				status: 'ready',
				source: 'network',
				updatedAt: Date.now(),
				isStale: false,
				error: null,
			});
			await this.service.cacheConversation(userId, ticketId, data);
		} catch (error: unknown) {
			useSupportTicketStore.getState().setConversation(ticketId, {
				data: current?.data ?? null,
				status: current?.data ? 'ready' : 'error',
				source: current?.source ?? 'memory',
				updatedAt: current?.updatedAt ?? null,
				isStale: true,
				error: new ServiceResultError(
					'network',
					error instanceof Error
						? error.message
						: 'Ticket conversation could not be loaded.',
					error
				),
			});
		}
	}
	private merge(messages: SupportTicketMessage[]): SupportTicketMessage[] {
		const unique = new Map(
			messages.map((message) => [message.id, message] as const)
		);
		return [...unique.values()].sort(
			(left, right) =>
				left.createdAt.localeCompare(right.createdAt) ||
				left.id.localeCompare(right.id)
		);
	}
}
export const supportTicketResourceService =
	SupportTicketResourceService.getInstance();
