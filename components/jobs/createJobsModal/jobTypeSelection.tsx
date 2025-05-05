/* components/jobCreation/JobTypeSelection.tsx */
import { Job } from '@/app/types/global';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

type JobCat = 'professional' | 'freelancer' | 'quickTask';
type FreelanceOpt = 'promoteSelf' | 'postRequest';

interface Props {
  jobCategory: JobCat;
  setJobCategory: (c: JobCat) => void;
  freelancerOption: FreelanceOpt;
  setFreelancerOption: (o: FreelanceOpt) => void;
}

export const JobTypeSelection = ({
  jobCategory,
  setJobCategory,
  freelancerOption,
  setFreelancerOption,
}: Props) => {
  /* card helper */
  const Card = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderWidth: 2,
        borderColor: active ? '#01eb53' : '#D1D5DB',
        backgroundColor: active ? '#ECFDF5' : '#FFFFFF',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontWeight: '600',
          fontSize: 12,
          textTransform: 'capitalize',
          color: active ? '#065F46' : '#374151',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
        Select Job Type
      </Text>

      {/* 3-column grid */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(['professional', 'freelancer', 'quickTask'] as JobCat[]).map(type => (
          <Card
            key={type}
            label={type === 'quickTask' ? 'Quick Task' : type}
            active={jobCategory === type}
            onPress={() => setJobCategory(type)}
          />
        ))}
      </View>

      {/* freelancer sub-options */}
      {jobCategory === 'freelancer' && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
            Freelancer Option
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(['promoteSelf', 'postRequest'] as FreelanceOpt[]).map(opt => (
              <Card
                key={opt}
                label={opt === 'promoteSelf' ? 'Promote Yourself' : 'Post a Request'}
                active={freelancerOption === opt}
                onPress={() => setFreelancerOption(opt)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};
