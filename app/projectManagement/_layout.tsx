import { Slot } from 'expo-router';
import PageAccessBoundary from '@/components/pageAccess/PageAccessBoundary';

export default function ProjectsLayout() {
  return <PageAccessBoundary><Slot /></PageAccessBoundary>;
}
