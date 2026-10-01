import { Slot } from 'expo-router';
import PageAccessBoundary from '@/components/pageAccess/PageAccessBoundary';
export default function MarketplaceLayout() { return <PageAccessBoundary><Slot /></PageAccessBoundary>; }
