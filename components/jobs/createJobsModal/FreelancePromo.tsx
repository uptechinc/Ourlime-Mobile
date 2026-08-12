// components/jobCreation/PromoteYourselfForm.tsx
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

type Availability = 'Freelance' | 'Full-time' | 'Part-time';

type FreelancerDetails = {
  name: string;
  skills: string[];
  experience: string;
  portfolioLink: string;
  availability: Availability;
  hourlyRate: string;
  bio: string;
};

type PromoteYourselfFormProps = {
  freelancerDetails: FreelancerDetails;
  setFreelancerDetails: (details: FreelancerDetails) => void;
};

export const PromoteYourselfForm = ({
  freelancerDetails,
  setFreelancerDetails,
}: PromoteYourselfFormProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Promote Yourself as a Freelancer</Text>

      {/* Name */}
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={freelancerDetails.name}
          onChangeText={name =>
            setFreelancerDetails({ ...freelancerDetails, name })
          }
          style={styles.input}
          placeholder="Your full name"
        />
      </View>

      {/* Skills */}
      <View style={styles.field}>
        <Text style={styles.label}>Skills</Text>
        <TextInput
          value={freelancerDetails.skills.join(', ')}
          onChangeText={skills =>
            setFreelancerDetails({
              ...freelancerDetails,
              skills: skills.split(',').map(s => s.trim()),
            })
          }
          style={styles.input}
          placeholder="e.g., React, Node.js"
        />
      </View>

      {/* Experience */}
      <View style={styles.field}>
        <Text style={styles.label}>Experience</Text>
        <TextInput
          value={freelancerDetails.experience}
          onChangeText={experience =>
            setFreelancerDetails({ ...freelancerDetails, experience })
          }
          style={[styles.input, styles.textArea]}
          placeholder="Describe your experience"
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Portfolio Link */}
      <View style={styles.field}>
        <Text style={styles.label}>Portfolio Link</Text>
        <TextInput
          value={freelancerDetails.portfolioLink}
          onChangeText={portfolioLink =>
            setFreelancerDetails({ ...freelancerDetails, portfolioLink })
          }
          style={styles.input}
          placeholder="https://your-portfolio.com"
          autoCapitalize="none"
        />
      </View>

      {/* Availability */}
      <View style={styles.field}>
        <Text style={styles.label}>Availability</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={freelancerDetails.availability}
            onValueChange={value =>
              setFreelancerDetails({
                ...freelancerDetails,
                availability: value as Availability,
              })
            }
            style={styles.picker}
          >
            <Picker.Item label="Freelance" value="Freelance" />
            <Picker.Item label="Full-time" value="Full-time" />
            <Picker.Item label="Part-time" value="Part-time" />
          </Picker>
        </View>
      </View>

      {/* Hourly Rate */}
      <View style={styles.field}>
        <Text style={styles.label}>Hourly Rate</Text>
        <TextInput
          value={freelancerDetails.hourlyRate}
          onChangeText={hourlyRate =>
            setFreelancerDetails({ ...freelancerDetails, hourlyRate })
          }
          style={styles.input}
          placeholder="e.g., 50"
          keyboardType="numeric"
        />
      </View>

      {/* Bio */}
      <View style={styles.field}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          value={freelancerDetails.bio}
          onChangeText={bio =>
            setFreelancerDetails({ ...freelancerDetails, bio })
          }
          style={[styles.input, styles.textArea]}
          multiline
          numberOfLines={4}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  picker: {
    height: 44,
    width: '100%',
  },
});
