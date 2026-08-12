/* components/jobCreation/TaskDetailsForm.tsx */
import { View, Text, TextInput, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

type TaskDetailsFormProps = {
  taskDetails: {
    urgency: 'low' | 'medium' | 'high';
    duration: string;
    complexity: 'simple' | 'moderate' | 'complex';
  };
  setTaskDetails: (details: TaskDetailsFormProps['taskDetails']) => void;
};

export const TaskDetailsForm = ({
  taskDetails,
  setTaskDetails,
}: TaskDetailsFormProps) => {
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
        Task Details
      </Text>

      {/* Urgency */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
          Task Urgency
        </Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: '#D1D5DB',
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Picker
            selectedValue={taskDetails.urgency}
            onValueChange={(u) =>
              setTaskDetails({ ...taskDetails, urgency: u })
            }
          >
            <Picker.Item label="Low Priority"    value="low" />
            <Picker.Item label="Medium Priority" value="medium" />
            <Picker.Item label="High Priority"   value="high" />
          </Picker>
        </View>
      </View>

      {/* Duration */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
          Task Duration
        </Text>
        <TextInput
          value={taskDetails.duration}
          onChangeText={(d) =>
            setTaskDetails({ ...taskDetails, duration: d })
          }
          placeholder="e.g., 2 hours"
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

      {/* Complexity */}
      <View>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
          Task Complexity
        </Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: '#D1D5DB',
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Picker
            selectedValue={taskDetails.complexity}
            onValueChange={(c) =>
              setTaskDetails({ ...taskDetails, complexity: c })
            }
          >
            <Picker.Item label="Simple"   value="simple" />
            <Picker.Item label="Moderate" value="moderate" />
            <Picker.Item label="Complex"  value="complex" />
          </Picker>
        </View>
      </View>
    </View>
  );
};
