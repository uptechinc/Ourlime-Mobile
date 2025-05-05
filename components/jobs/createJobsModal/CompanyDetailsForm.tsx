/* components/jobCreation/CompanyDetailsForm.tsx */
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

interface CompanyDetails {
  name: string;
  size: string;
  industry: string;
  benefits: string[];
}

interface Props {
  companyDetails: CompanyDetails;
  setCompanyDetails: (d: CompanyDetails) => void;
  newBenefit: string;
  setNewBenefit: (b: string) => void;
}

export const CompanyDetailsForm = ({
  companyDetails,
  setCompanyDetails,
  newBenefit,
  setNewBenefit,
}: Props) => {
  /* add benefit on press / return */
  const pushBenefit = () => {
    const trimmed = newBenefit.trim();
    if (!trimmed) return;
    setCompanyDetails({
      ...companyDetails,
      benefits: [...companyDetails.benefits, trimmed],
    });
    setNewBenefit('');
  };

  return (
    <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
        Company Details
      </Text>
      
      {/* Name */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Company Name</Text>
        <TextInput
          value={companyDetails.name}
          onChangeText={v => setCompanyDetails({ ...companyDetails, name: v })}
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

      {/* Size */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Company Size</Text>
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
            selectedValue={companyDetails.size}
            onValueChange={v => setCompanyDetails({ ...companyDetails, size: v })}
          >
            <Picker.Item label="Select size" value="" />
            <Picker.Item label="1-10 employees"  value="1-10" />
            <Picker.Item label="11-50 employees" value="11-50" />
            <Picker.Item label="51-200 employees" value="51-200" />
            <Picker.Item label="201-500 employees" value="201-500" />
            <Picker.Item label="501+ employees"  value="501+" />
          </Picker>
        </View>
      </View>
      

      {/* Industry */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Industry</Text>
        <TextInput
          value={companyDetails.industry}
          onChangeText={v => setCompanyDetails({ ...companyDetails, industry: v })}
          placeholder="e.g., Technology, Healthcare"
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

      {/* Benefits */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Benefits</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {companyDetails.benefits.map((b, i) => (
            <View
              key={i}
              style={{
                backgroundColor: '#E5E7EB',
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 12, color: '#374151' }}>{b}</Text>
            </View>
          ))}
        </View>

        {/* benefit input */}
        <TextInput
          value={newBenefit}
          onChangeText={setNewBenefit}
          onSubmitEditing={pushBenefit}
          placeholder="Add a benefit"
          style={{
            borderWidth: 1,
            borderColor: '#D1D5DB',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            backgroundColor: '#FFFFFF',
          }}
        />
        <TouchableOpacity
          onPress={pushBenefit}
          style={{
            alignSelf: 'flex-end',
            marginTop: 8,
            backgroundColor: '#01eb53',
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Add Benefit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
