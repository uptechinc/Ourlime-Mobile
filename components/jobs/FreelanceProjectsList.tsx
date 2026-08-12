import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Clock,
  DollarSign,
  Star,
  Calendar,
  UserPlus,
  Briefcase,
} from 'lucide-react-native';

import JobApplicationModal from './applyJobs/JobApplicationModal';
import type { JobRecord } from '@/lib/job/JobsService';

type FreelanceProjectsListProps = {
  jobs: JobRecord[];
};

export const FreelanceProjectsList = ({ jobs }: FreelanceProjectsListProps) => {
  const freelanceProjects = jobs.filter(j => j.basic_info.type === 'freelancer');
  const promoteList = freelanceProjects.filter(j => j.category_specific?.type === 'promote');
  const requestList  = freelanceProjects.filter(j => j.category_specific?.type === 'request');

  const [activeTab, setActiveTab] = useState<'promote' | 'request'>('promote');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<JobRecord | null>(null);

  const handleApply = (proj: JobRecord) => {
    setSelected(proj);
    setModalOpen(true);
  };

  if (!freelanceProjects.length)
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Text style={{ color: '#6B7280' }}>No freelance projects available.</Text>
      </View>
    );

  /* ─── card component ─── */
  const Card = ({ project }: { project: JobRecord }) => {
    // const isCreator = auth.currentUser?.uid === project.basic_info.userId;
    const isCreator = false;

    return (
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: '#F3F4F6',
        }}
      >
        {/* left / creator */}
        <View
          style={{
            width: '100%',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#F3F4F6',
            alignItems: 'center',
          }}
        >
          <Image
            source={{ uri: project.creator?.profileImage ?? 'https://via.placeholder.com/96' }}
            style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 12 }}
          />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
            {project.creator?.name ?? 'Unknown'}
          </Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
            @{project.creator?.username ?? 'username'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 }}>
            <Star size={14} color="#FACC15" fill="#FACC15" />
            <Text style={{ fontSize: 12 }}>4.9</Text>
          </View>

          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
            15 projects posted
          </Text>
        </View>

        {/* right / details */}
        <View style={{ padding: 16 }}>
          {/* header row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                {project.basic_info.title}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Calendar size={16} color="#9CA3AF" />
                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                  {project.category_specific?.timeline ?? 'Flexible'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <DollarSign size={16} color="#9CA3AF" />
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>
                    {project.basic_info.priceRange.from} - {project.basic_info.priceRange.to}
                  </Text>
                </View>
              </View>
            </View>

            {!isCreator && (
              <TouchableOpacity
                onPress={() => handleApply(project)}
                style={{
                  backgroundColor: '#01eb53',
                  paddingHorizontal: 20,
                  paddingVertical: 4,
                  height: 32,
                  borderRadius: 999,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  {activeTab === 'promote' ? 'Contact' : 'Proposal'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={{ color: '#6B7280', marginBottom: 12 }} numberOfLines={3}>
            {project.basic_info.description}
          </Text>

          {/* skills */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 4, color: '#374151' }}>
              {activeTab === 'promote' ? 'Skills Offered' : 'Required Skills'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {project.details.skills?.map((s: string, i: number) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: '#F3F4F6',
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#374151' }}>{s}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* footer */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              borderTopWidth: 1,
              borderTopColor: '#F3F4F6',
              paddingTop: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={16} color="#9CA3AF" />
              <Text style={{ fontSize: 12, color: '#6B7280' }}>
                Posted{' '}
                {project.basic_info.createdAt?.seconds ? new Date(project.basic_info.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
              </Text>
            </View>
            <TouchableOpacity>
              <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>
                {activeTab === 'promote' ? 'Save Profile' : 'Save Project'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  /* ─── UI ─── */
  return (
    <>
      {/* Toggle tabs */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
        {(['promote', 'request'] as const).map(tab => {
          const active = activeTab === tab;
          const Icon = tab === 'promote' ? UserPlus : Briefcase;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: active ? '#01eb53' : '#E5E7EB',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderTopLeftRadius: tab === 'promote' ? 999 : 0,
                borderBottomLeftRadius: tab === 'promote' ? 999 : 0,
                borderTopRightRadius: tab === 'request' ? 999 : 0,
                borderBottomRightRadius: tab === 'request' ? 999 : 0,
              }}
            >
              <Icon size={16} color={active ? '#FFFFFF' : '#374151'} />
              <Text style={{ color: active ? '#FFFFFF' : '#374151', fontWeight: '600' }}>
                {tab === 'promote' ? 'Find Freelancers' : 'Find Gigs'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* list */}
      <ScrollView contentContainerStyle={{ gap: 16, paddingHorizontal: 20 }}>
        {(activeTab === 'promote' ? promoteList : requestList).map(p => (
          <Card key={p.id} project={p} />
        ))}
      </ScrollView>

      {/* modal */}
      {selected && (
        <JobApplicationModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          job={selected}
          jobType="freelance"
        />
      )}
    </>
  );
};
