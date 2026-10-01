import { Slot } from 'expo-router';
import PageAccessBoundary from '@/components/pageAccess/PageAccessBoundary';

export default function BlogsLayout() {
  return <PageAccessBoundary><Slot /></PageAccessBoundary>;
}
