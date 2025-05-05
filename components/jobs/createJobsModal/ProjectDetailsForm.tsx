/* components/jobCreation/ProjectDetailsForm.tsx */
import React from 'react';
import { View, Text, TextInput, Platform } from 'react-native';

interface ProjectDetailsFormProps {
  projectDetails: {
    timeline: string;
    milestones: string[];
    deliverables: string[];
    technicalRequirements: string[];
  };
  setProjectDetails: (details: ProjectDetailsFormProps['projectDetails']) => void;
}

export const ProjectDetailsForm = ({
  projectDetails,
  setProjectDetails,
}: ProjectDetailsFormProps) => {
  return (
    <View
      style={{
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: '#374151',
          marginBottom: 12,
        }}
      >
        Project Details
      </Text>

      {/* Timeline */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
          Project Timeline
        </Text>
        <TextInput
          value={projectDetails.timeline}
          onChangeText={(value) =>
            setProjectDetails({ ...projectDetails, timeline: value })
          }
          placeholder="e.g., 3 months"
          style={{
            borderWidth: 1,
            borderColor: '#D1D5DB',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            backgroundColor: '#FFFFFF',
          }}
        />
      </View>

      {/* Deliverables */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
          Project Deliverables
        </Text>
        <TextInput
          value={projectDetails.deliverables.join('\n')}
          onChangeText={(value) =>
            setProjectDetails({
              ...projectDetails,
              deliverables: value
                .split('\n')
                .filter((item) => item.trim() !== ''),
            })
          }
          placeholder="List your deliverables (one per line)"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{
            borderWidth: 1,
            borderColor: '#D1D5DB',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            backgroundColor: '#FFFFFF',
          }}
        />
      </View>

      {/* Milestones */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
          Project Milestones
        </Text>
        <TextInput
          value={projectDetails.milestones.join('\n')}
          onChangeText={(value) =>
            setProjectDetails({
              ...projectDetails,
              milestones: value
                .split('\n')
                .filter((item) => item.trim() !== ''),
            })
          }
          placeholder="List your milestones (one per line)"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{
            borderWidth: 1,
            borderColor: '#D1D5DB',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            backgroundColor: '#FFFFFF',
          }}
        />
      </View>

      {/* Technical Requirements */}
      <View>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
          Technical Requirements
        </Text>
        <TextInput
          value={projectDetails.technicalRequirements.join('\n')}
          onChangeText={(value) =>
            setProjectDetails({
              ...projectDetails,
              technicalRequirements: value
                .split('\n')
                .filter((item) => item.trim() !== ''),
            })
          }
          placeholder="List technical requirements (one per line)"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{
            borderWidth: 1,
            borderColor: '#D1D5DB',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            backgroundColor: '#FFFFFF',
          }}
        />
      </View>
    </View>
  );
};
