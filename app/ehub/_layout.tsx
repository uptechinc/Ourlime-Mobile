import { Slot } from 'expo-router';
import PageAccessBoundary from '@/components/pageAccess/PageAccessBoundary';
export default function EHubLayout() { return <PageAccessBoundary><Slot /></PageAccessBoundary>; }
