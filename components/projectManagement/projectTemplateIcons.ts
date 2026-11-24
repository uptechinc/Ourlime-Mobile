import { Briefcase, CodeXml, FilePlus, GraduationCap, HandHeart, HeartHandshake, PartyPopper, Target } from 'lucide-react-native';
import type { ProjectTemplateId } from '@/lib/services/ProjectTemplateService';

/** The icon shown on each project template card. */
export const PROJECT_TEMPLATE_ICONS: { [id in ProjectTemplateId]: typeof Target } = {
  'personal-goal': Target,
  'community-initiative': HeartHandshake,
  'class-project': GraduationCap,
  'business-service': Briefcase,
  'event-production': PartyPopper,
  'volunteer-campaign': HandHeart,
  'software-project': CodeXml,
  blank: FilePlus,
};
