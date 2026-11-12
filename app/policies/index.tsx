import { useLocalSearchParams } from 'expo-router';
import PoliciesScreen from '@/components/policies/PoliciesScreen';

/** The website's /policies page. ?section= (a policy or section id, the website's #anchor) opens at that heading. */
export default function PoliciesRoute() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return <PoliciesScreen initialAnchor={typeof section === 'string' ? section : undefined} />;
}
