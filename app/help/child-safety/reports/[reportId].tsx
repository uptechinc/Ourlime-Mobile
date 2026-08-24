import { useLocalSearchParams } from 'expo-router';
import ChildSafetyConversationScreen from '@/components/safety/ChildSafetyConversationScreen';
export default function ChildSafetyReportConversationRoute() { const { reportId, reviewerMode } = useLocalSearchParams<{ reportId: string; reviewerMode?: string }>(); return <ChildSafetyConversationScreen reportId={reportId} reviewerMode={reviewerMode === '1'} />; }
