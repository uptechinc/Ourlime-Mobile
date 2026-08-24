import { create } from 'zustand';
import type { ResourceState } from '@/lib/types/resourceState';
import type { SupportMessagePage, SupportTicket, SupportTicketPage } from '@/lib/types/support';

type SupportTicketStore = {
  tickets: ResourceState<SupportTicketPage>;
  conversations: { [ticketId: string]: ResourceState<SupportMessagePage> };
  selectedTickets: { [ticketId: string]: SupportTicket };
  setTickets: (state: ResourceState<SupportTicketPage>) => void;
  setConversation: (ticketId: string, state: ResourceState<SupportMessagePage>) => void;
  setSelectedTicket: (ticket: SupportTicket) => void;
  clear: () => void;
};

const emptyTickets: ResourceState<SupportTicketPage> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };

export const useSupportTicketStore = create<SupportTicketStore>((set) => ({
  tickets: emptyTickets,
  conversations: {},
  selectedTickets: {},
  setTickets: (tickets) => set({ tickets }),
  setConversation: (ticketId, state) => set((current) => ({ conversations: { ...current.conversations, [ticketId]: state } })),
  setSelectedTicket: (ticket) => set((current) => ({ selectedTickets: { ...current.selectedTickets, [ticket.id]: ticket } })),
  clear: () => set({ tickets: emptyTickets, conversations: {}, selectedTickets: {} }),
}));
