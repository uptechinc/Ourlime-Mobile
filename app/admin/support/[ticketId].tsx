import { useLocalSearchParams } from 'expo-router';
import SupportTicketConversationScreen from '@/components/support/SupportTicketConversationScreen';
export default function AdminSupportTicketRoute() { const { ticketId } = useLocalSearchParams<{ ticketId: string }>(); return <SupportTicketConversationScreen ticketId={ticketId} staffMode />; }
