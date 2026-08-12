// components/jobs/JobsPage.tsx
import { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import {
  Search,
  Clock,
  Sliders,
  Code,
  Palette,
  LineChart,
  Building2,
  BookOpen,
  Wrench,
  Landmark,
  ShoppingBag,
  Utensils,
  Stethoscope,
  Briefcase,
  Plus,
  type LucideIcon,
} from 'lucide-react-native';
import Swiper from 'react-native-swiper';

import { ProfessionalJobsList } from '@/components/jobs/ProfessionalJobsList';
import { QuickTasksList } from '@/components/jobs/QuickTasksList';
import { FreelanceProjectsList } from '@/components/jobs/FreelanceProjectsList';
import JobCreationModal from '@/components/jobs/createJobsModal/jobCreationModal';
import PageHeader from '@/components/ui/PageHeader';
import {useRouter} from 'expo-router';
import type { JobRecord } from '@/lib/job/JobsService';

const { width } = Dimensions.get('window');

// Dummy data
const dummyJobs: JobRecord[] = [
  // Professional
  {
    id: 'p1',
    basic_info: {
      type: 'professional',
      title: 'Senior React Native Engineer',
      description: 'Build high-performance mobile apps with Expo & TypeScript.',
      userId: 'u1',
      location: { type: 'remote', city: '', country: '' },
      priceRange: { from: 60, to: 80 },
      createdAt: { seconds: 1620000000 },
    },
    category: 'Development',
    category_specific: {
      name: 'Acme Corp',
      industry: 'Technology',
      size: '201-500',
      benefits: ['Health Insurance', '401k Matching'],
    },
    details: { skills: ['React Native', 'TypeScript', 'Expo'] },
  },
  // Quick Task
  {
    id: 'q1',
    basic_info: {
      type: 'quickTask',
      title: 'Logo Design',
      description: 'Design a modern logo for our fintech startup.',
      userId: 'u2',
      location: { type: 'remote', city: '', country: '' },
      priceRange: { from: 50, to: 100 },
      createdAt: { seconds: 1625000000 },
    },
    details: { skills: ['Illustrator', 'Creativity'] },
    category_specific: { urgency: 'medium', duration: '2 days', complexity: 'simple' },
  },
  // Freelance Promote
  {
    id: 'f1',
    basic_info: {
      type: 'freelancer',
      title: 'Full-Stack Developer Available',
      description: 'Experienced Node & React dev ready for your projects.',
      userId: 'u3',
      location: { type: 'remote', city: '', country: '' },
      priceRange: { from: 40, to: 40 },
      createdAt: { seconds: 1630000000 },
    },
    details: { skills: ['Node.js', 'React', 'GraphQL'] },
    category_specific: { type: 'promote', proposals: 3, timeline: 'Flexible' },
  },
  // Freelance Request
  {
    id: 'f2',
    basic_info: {
      type: 'freelancer',
      title: 'E-commerce Site Build',
      description: 'Need an e-commerce site with Next.js and Stripe.',
      userId: 'u4',
      location: { type: 'onsite', city: 'London', country: 'UK' },
      priceRange: { from: 2000, to: 5000 },
      createdAt: { seconds: 1635000000 },
    },
    details: { skills: ['Next.js', 'Stripe', 'Tailwind'] },
    category_specific: {
      type: 'request',
      proposals: 0,
      timeline: '1 month',
      deliverables: ['Setup Next.js', 'Integrate Stripe', 'Deploy to Vercel'],
    },
  },
];

export default function JobsPage() {
  const router = useRouter();
  const [jobs] = useState(dummyJobs);
  const [filtered, setFiltered] = useState(dummyJobs);
  const [categories, setCategories] = useState<
    { name: string; count: number; icon: LucideIcon }[]
  >([]);
  const [activeJobType, setActiveJobType] = useState<'professional' | 'quicktasks' | 'freelance'>(
    'professional'
  );
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Derive categories & filter by search
  useEffect(() => {
    const iconMap: Record<string, LucideIcon> = {
      'Development': Code,
      'Design': Palette,
      'Marketing': LineChart,
      'Business': Building2,
      'Teaching': BookOpen,
      'Plumbing': Wrench,
      'Banking': Landmark,
      'Retail': ShoppingBag,
      'Food Service': Utensils,
      'Healthcare': Stethoscope,
      'Uncategorized': Briefcase,
    };

    // categories
    const counts: Record<string, number> = {};
    jobs.forEach((job: (typeof dummyJobs)[number]) => {
      const categoryName = job.category ?? 'Uncategorized';
      counts[categoryName] = (counts[categoryName] ?? 0) + 1;
    });
    const cats = Object.entries(counts)
      .map(([name, count]) => ({ name, count, icon: iconMap[name] ?? Briefcase }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    setCategories(cats);

    // filter
    if (!search.trim()) {
      setFiltered(jobs);
    } else {
      const q = search.toLowerCase();
      setFiltered(
        jobs.filter(
          (job: (typeof dummyJobs)[number]) =>
            job.basic_info.title.toLowerCase().includes(q) ||
            job.basic_info.description.toLowerCase().includes(q) ||
            (job.category_specific.name?.toLowerCase() ?? '').includes(q) ||
            job.details.skills.some((skill: string) => skill.toLowerCase().includes(q))
        )
      );
    }
  }, [jobs, search]);

  const renderList = () => {
    if (!filtered.length) {
      return (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <Text style={{ color: '#6B7280' }}>No jobs found.</Text>
        </View>
      );
    }
    if (activeJobType === 'professional') return <ProfessionalJobsList jobs={filtered} />;
    if (activeJobType === 'quicktasks') return <QuickTasksList jobs={filtered} />;
    return <FreelanceProjectsList jobs={filtered} />;
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <PageHeader 
        title="Jobs"
        onBackPress={() => router.back()}
        />
        {/* Hero */}
        <View style={{ paddingHorizontal: 20, paddingTop: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center' }}>
            Find Your Next Career Opportunity
          </Text>
          <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
            Discover{' '}
            <Text style={{ color: '#01eb53', fontWeight: '700' }}>{jobs.length}</Text> opportunities
          </Text>
        </View>

        {/* Search + Filters */}
        <View
          style={{
            marginHorizontal: 20,
            marginTop: 16,
            padding: 16,
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            // iOS shadow
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            // Android shadow
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F9FAFB',
                borderRadius: 12,
                paddingHorizontal: 12,
                height: Platform.OS === 'ios' ? 40 : 44,
              }}
            >
              <Search size={20} color="#9CA3AF" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search jobs..."
                style={{
                  flex: 1,
                  marginLeft: 8,
                  fontSize: 14,
                  height: '100%',
                }}
                returnKeyType="search"
                onSubmitEditing={() => setSearch(search.trim())}
              />
            </View>
            <TouchableOpacity
              onPress={() => setSearch(search.trim())}
              style={{
                marginLeft: 12,
                backgroundColor: '#01eb53',
                borderRadius: 12,
                paddingHorizontal: 20,
                height: Platform.OS === 'ios' ? 40 : 44,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: '600' }}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Tags */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 12 }}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            {['Remote', 'Full-time', 'Tech', 'Marketing', 'Design'].map((tag) => (
              <View
                key={tag}
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  marginRight: 8,
                }}
              >
                <Text style={{ fontSize: 12, color: '#6B7280' }}>{tag}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: '#F0FDF4',
              }}
            >
              <Sliders size={16} color="#10B981" />
              <Text style={{ fontSize: 12, color: '#10B981', marginLeft: 4 }}>Advanced</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Create Job */}
        <TouchableOpacity
          onPress={() => setModalOpen(true)}
          style={{
            flexDirection: 'row',
            alignSelf: 'flex-end',
            backgroundColor: '#01eb53',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 999,
            marginRight: 20,
            marginTop: 16,
            alignItems: 'center',
          }}
        >
          <Plus size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '600', marginLeft: 6 }}>Create Job</Text>
        </TouchableOpacity>

        {/* Categories Carousel */}
        {categories.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 20,
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                Popular Categories
              </Text>
              <TouchableOpacity>
                <Text style={{ color: '#01eb53', fontSize: 14 }}>View All</Text>
              </TouchableOpacity>
            </View>
            <Swiper
              showsPagination
              dotColor="#D1D5DB"
              activeDotColor="#01eb53"
              paginationStyle={{ bottom: -18 }}
              loop={false}
              height={160}
              width={width}
              dotStyle={{ width: 6, height: 6, borderRadius: 3 }}
            >
              {categories.map((c) => (
                <View
                  key={c.name}
                  style={{
                    backgroundColor: '#FFF',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#F3F4F6',
                    marginHorizontal: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 20,
                    height: 140,
                  }}
                >
                  <c.icon size={32} color="#01eb53" style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
                    {c.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>{c.count} jobs</Text>
                </View>
              ))}
            </Swiper>
          </View>
        )}

        {/* Job Type Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 24, paddingLeft: 20, marginBottom: 12 }}>
          {([
            { id: 'professional', label: 'Professional Jobs', icon: Briefcase },
            { id: 'quicktasks',  label: 'Quick Tasks',        icon: Clock    },
            { id: 'freelance',   label: 'Freelance',          icon: Code     },
          ] as const).map((t) => {
            const active = t.id === activeJobType;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setActiveJobType(t.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: active ? '#01eb53' : '#FFF',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  marginRight: 12,
                }}
              >
                <t.icon size={18} color={active ? '#FFF' : '#01eb53'} />
                <Text style={{ marginLeft: 6, color: active ? '#FFF' : '#000000', fontWeight: active ? '600' : '400' }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Listings */}
        {renderList()}
      </ScrollView>

      {/* Job Creation Modal */}
      {modalOpen && <JobCreationModal isOpen onClose={() => setModalOpen(false)} />}
    </>
  );
}
