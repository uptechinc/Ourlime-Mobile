import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Clock,
  DollarSign,
  MapPin,
  Star,
  Timer,
  AlertCircle,
} from 'lucide-react-native';

import JobApplicationModal from './applyJobs/JobApplicationModal';
// import { auth } from '@/lib/firebaseConfig';   // uncomment if you use auth

interface Props {
  jobs: any[];
}

export const QuickTasksList = ({ jobs }: Props) => {
  const quickTasks = jobs.filter(j => j.basic_info.type === 'quickTask');

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const handleApply = (task: any) => {
    setSelected(task);
    setModalOpen(true);
  };

  if (!quickTasks.length)
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Text style={{ color: '#6B7280' }}>No quick tasks available.</Text>
      </View>
    );

  /* single card */
  const Card = ({ task }: { task: any }) => {
    // const isCreator = auth.currentUser?.uid === task.basic_info.userId;
    const isCreator = false;

    const urgencyColor =
      task.category_specific?.urgency === 'high'
        ? ['#F87171', '#FEE2E2']
        : task.category_specific?.urgency === 'medium'
        ? ['#FBBF24', '#FEF3C7']
        : ['#10B981', '#D1FAE5'];

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
        {/* header gradient */}
        <View
          style={{
            height: 120,
            backgroundColor: '#ECFDF5',
            padding: 12,
            justifyContent: 'flex-end',
          }}
        >
          <View style={{ flexDirection: 'row', gap: 6, position: 'absolute', top: 8, right: 8 }}>
            <View
              style={{
                backgroundColor: '#FFFFFFCC',
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#10B981' }}>Quick Task</Text>
            </View>
            <View
              style={{
                backgroundColor: urgencyColor[1],
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: urgencyColor[0] }}>
                {task.category_specific?.urgency ?? 'Medium'} Priority
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image
              source={{
                uri: task.creator?.profileImage ?? 'https://via.placeholder.com/80',
              }}
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                borderWidth: 4,
                borderColor: '#FFFFFF',
              }}
            />
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Star size={14} color="#FACC15" fill="#FACC15" />
                <Text style={{ fontSize: 12, fontWeight: '600' }}>4.8</Text>
              </View>
            </View>
          </View>
        </View>

        {/* body */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
            {task.basic_info.title}
          </Text>
          <Text
            style={{ color: '#6B7280', marginBottom: 12 }}
            numberOfLines={2}
          >
            {task.basic_info.description}
          </Text>

          {/* skills */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {task.details.skills?.map((s: string, i: number) => (
              <View
                key={i}
                style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 12, color: '#374151' }}>{s}</Text>
              </View>
            ))}
          </View>

          {/* badges */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <Badge icon={Timer} label={task.category_specific?.duration ?? 'Flexible'} />
            <Badge
              icon={MapPin}
              label={
                task.basic_info.location.type === 'remote'
                  ? 'Remote'
                  : `${task.basic_info.location.city}, ${task.basic_info.location.country}`
              }
            />
            <Badge
              icon={DollarSign}
              label={`${task.basic_info.priceRange.from}-${task.basic_info.priceRange.to}`}
            />
            <Badge
              icon={AlertCircle}
              label={`${task.category_specific?.complexity ?? 'Moderate'} complexity`}
            />
          </View>

          {/* footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#6B7280' }}>
              Posted {new Date(task.basic_info.createdAt.seconds * 1000).toLocaleDateString()}
            </Text>
            {!isCreator && (
              <TouchableOpacity
                onPress={() => handleApply(task)}
                style={{
                  backgroundColor: '#01eb53',
                  borderRadius: 999,
                  paddingHorizontal: 20,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Apply Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  /* helper badge */
  const Badge = ({ icon: Icon, label }: { icon: any; label: string }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Icon size={14} color="#9CA3AF" />
      <Text style={{ fontSize: 12, color: '#374151' }}>{label}</Text>
    </View>
  );

  /* list */
  return (
    <>
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingHorizontal: 20 }}
      >
        {quickTasks.map(t => (
          <Card key={t.id} task={t} />
        ))}
      </ScrollView>

      {modalOpen && (
        <JobApplicationModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          job={selected}
          jobType="quicktasks"
        />
      )}
    </>
  );
};
