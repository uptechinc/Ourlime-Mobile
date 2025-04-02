import React, { useState } from 'react';
import { BookOpen, BookText, Users, Calendar } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { HeroSection } from '@/components/eLearning/heroSection/HeroSection';
import { CourseMessages } from '@/components/eLearning/courseMessages/CourseMessages';
import { LearningMaterials } from '@/components/eLearning/learningMaterials/LearningMaterials';  
import { Resources } from '@/components/eLearning/resources/Resources';
import { Tutors } from '@/components/eLearning/tutors/Tutors';
import { Schedule } from '@/components/eLearning/schedules/Schedules';
import { useRouter } from 'expo-router';

export default function ELearningScreen() {
  const [activeSection, setActiveSection] = useState<'courseMaterials' | 'schedule'>('courseMaterials');
  const [activeTab, setActiveTab] = useState<'materials' | 'resources' | 'tutors'>('materials');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const sections = [
    { id: 'courseMaterials', label: 'Course Materials', icon: BookOpen },
    { id: 'schedule', label: 'Schedule Work', icon: Calendar },
  ];

  const tabs = [
    { id: 'materials', label: 'Learning Materials', icon: BookOpen },
    { id: 'resources', label: 'Resources', icon: BookText },
    { id: 'tutors', label: 'Tutors', icon: Users },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F3F4F6' }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <HeroSection />
      <CourseMessages />

      {/* Section Buttons */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginTop: 24,
        paddingHorizontal: 16,
      }}>
        {sections.map(({ id, label, icon: Icon }) => (
          <TouchableOpacity
            key={id}
            onPress={() => setActiveSection(id as typeof activeSection)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 20,
              borderRadius: 16,
              backgroundColor: activeSection === id ? '#16a34a' : '#F3F4F6',
            }}
          >
            <Icon size={18} color={activeSection === id ? 'white' : '#4B5563'} />
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: activeSection === id ? 'white' : '#374151',
            }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Course Material Tabs */}
      {activeSection === 'courseMaterials' && (
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 16 }}
            contentContainerStyle={{ flexDirection: 'row', gap: 12 }}
          >
            {tabs.map(({ id, label, icon: Icon }) => (
              <TouchableOpacity
                key={id}
                onPress={() => setActiveTab(id as typeof activeTab)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: activeTab === id ? '#16a34a' : '#ffffff',
                  borderWidth: activeTab === id ? 0 : 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <Icon size={16} color={activeTab === id ? 'white' : '#4B5563'} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: activeTab === id ? 'white' : '#374151',
                }}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {activeTab === 'materials' && <LearningMaterials />}
          {activeTab === 'resources' && <Resources />}
          {activeTab === 'tutors' && <Tutors />}
        </View>
      )}

      {/* Schedule Section */}
      {activeSection === 'schedule' && (
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Schedule />
        </View>
      )}
    </ScrollView>
  );
}
