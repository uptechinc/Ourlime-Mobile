import { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Bookmark,
  Clock,
  DollarSign,
  MapPin,
  Users,
  Building2,
} from 'lucide-react-native';

import JobApplicationModal from './applyJobs/JobApplicationModal';
import type { JobRecord } from '@/lib/job/JobsService';

type ProfessionalJobsListProps = {
  jobs: JobRecord[];
};

export const ProfessionalJobsList = ({ jobs }: ProfessionalJobsListProps) => {
  const professionalJobs = jobs.filter(j => j.basic_info.type === 'professional');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<JobRecord | null>(null);

  const handleApply = (job: JobRecord) => {
    setSelected(job);
    setModalOpen(true);
  };

  if (!professionalJobs.length)
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Text style={{ color: '#6B7280' }}>No professional jobs available.</Text>
      </View>
    );

  /* single card */
  const Card = ({ job }: { job: JobRecord }) => {
    // const isCreator = auth.currentUser?.uid === job.basic_info.userId;
    const isCreator = false;

    return (
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: '#E5E7EB',
        }}
      >
        {/* company column */}
        <View
          style={{
            backgroundColor: '#F9FAFB',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
          }}
        >
          <Image
            source={{
              uri: job.creator?.profileImage ?? 'https://via.placeholder.com/80',
            }}
            style={{ width: 80, height: 80, borderRadius: 12, marginBottom: 12 }}
          />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', textAlign: 'center' }}>
            {job.category_specific.name}
          </Text>
          <Text style={{ fontSize: 12, color: '#6B7280' }}>
            {job.category_specific.industry}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Building2 size={14} color="#9CA3AF" />
            <Text style={{ fontSize: 12, color: '#6B7280' }}>
              {job.category_specific.size} employees
            </Text>
          </View>
        </View>

        {/* details column */}
        <View style={{ padding: 16 }}>
          {/* header row */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                {job.basic_info.title}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <MapPin size={16} color="#9CA3AF" />
                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                  {job.basic_info.location.type === 'remote'
                    ? 'Remote'
                    : `${job.basic_info.location.city}, ${job.basic_info.location.country}`}
                </Text>
                <DollarSign size={16} color="#9CA3AF" />
                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                  ${job.basic_info.priceRange.from}-{job.basic_info.priceRange.to}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'center', gap: 6 }}>
              <TouchableOpacity style={{ padding: 6 }}>
                <Bookmark size={20} color="#9CA3AF" />
              </TouchableOpacity>
              {!isCreator && (
                <TouchableOpacity
                  onPress={() => handleApply(job)}
                  style={{
                    backgroundColor: '#01eb53',
                    paddingHorizontal: 20,
                    paddingVertical: 8,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Apply</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* skills */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {job.details.skills?.map((s: string, i: number) => (
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

          {/* benefits */}
          {!!job.category_specific.benefits?.length && (
            <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 4, color: '#374151' }}>
                Company Benefits
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {job.category_specific.benefits.map((b: string, i: number) => (
                  <View
                    key={i}
                    style={{
                      backgroundColor: '#EFF6FF',
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: '#1D4ED8' }}>{b}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* footer */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
              paddingTop: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={16} color="#9CA3AF" />
              <Text style={{ fontSize: 12, color: '#6B7280' }}>
                Posted {job.basic_info.createdAt?.seconds ? new Date(job.basic_info.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Users size={16} color="#9CA3AF" />
              <Text style={{ fontSize: 12, color: '#6B7280' }}>0 applicants</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ gap: 16, paddingHorizontal: 20 }}>
        {professionalJobs.map(j => (
          <Card key={j.id} job={j} />
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
          jobType="professional"
        />
      )}
    </>
  );
};
