/* components/jobCreation/BasicInformationForm.tsx */
import { View, Text, TextInput, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

type Props = {
  title: string;
  setTitle: (t: string) => void;
  description: string;
  setDescription: (d: string) => void;
  category: string;
  setCategory: (c: string) => void;
};

export const BasicInformationForm = ({
  title,
  setTitle,
  description,
  setDescription,
  category,
  setCategory,
}: Props) => {
  const categories = [
    'Development',
    'Design',
    'Marketing',
    'Business',
    'Teaching',
    'Plumbing',
    'Banking',
    'Retail',
    'Food Service',
    'Healthcare',
  ];

  return (
    <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
        Basic Information
      </Text>

      {/* Job Title */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Job Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Enter a clear title for your job"
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

      {/* Category */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Category</Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: '#D1D5DB',
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Picker selectedValue={category} onValueChange={setCategory}>
            <Picker.Item label="Select a category" value="" />
            {categories.map(c => (
              <Picker.Item key={c} label={c} value={c} />
            ))}
          </Picker>
        </View>
      </View>

      {/* Description */}
      <View>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Provide a detailed description of the job"
          multiline
          numberOfLines={4}
          style={{
            borderWidth: 1,
            borderColor: '#D1D5DB',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
            textAlignVertical: 'top',
            backgroundColor: '#FFFFFF',
          }}
        />
      </View>
    </View>
  );
};
