import { useState } from 'react';
import { BookOpen, BookText, Users, Calendar, GraduationCap, Award, Compass, ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { HeroSection } from '@/components/eLearning/heroSection/HeroSection';
import { CourseMessages } from '@/components/eLearning/courseMessages/CourseMessages';
import { LearningMaterials } from '@/components/eLearning/learningMaterials/LearningMaterials';
import { Resources } from '@/components/eLearning/resources/Resources';
import { Tutors } from '@/components/eLearning/tutors/Tutors';
import Schedule from '@/components/eLearning/schedules/Schedules';
import { useRouter, type Href } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';

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
    <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <PageHeader title="E-Learning" onBackPress={() => router.back()} />
      <ScrollView
        style={{ flex: 1, backgroundColor: '#F3F4F6' }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
        }}
      >
        <HeroSection />

        {/* Quick LMS Navigation Hub */}
        <View style={styles.hubContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/eLearning/courses' as Href)}
            style={[styles.hubCard, { backgroundColor: '#10b981' }]}
          >
            <Compass size={24} color="#ffffff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.hubCardTitle}>Browse Courses</Text>
              <Text style={styles.hubCardSubtitle}>Explore Caribbean & tech curricula</Text>
            </View>
            <ArrowRight size={18} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.hubRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/eLearning/my-learning' as Href)}
              style={[styles.hubSmallCard, { backgroundColor: '#3b82f6' }]}
            >
              <Award size={22} color="#ffffff" />
              <Text style={styles.hubSmallTitle}>My Learning</Text>
              <Text style={styles.hubSmallSubtitle}>Resume progress</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/eLearning/cxc' as Href)}
              style={[styles.hubSmallCard, { backgroundColor: '#8b5cf6' }]}
            >
              <GraduationCap size={22} color="#ffffff" />
              <Text style={styles.hubSmallTitle}>CXC Revision</Text>
              <Text style={styles.hubSmallSubtitle}>CSEC & CAPE Hub</Text>
            </TouchableOpacity>
          </View>
        </View>

        <CourseMessages />

        {/* Section Buttons */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 12,
            marginTop: 24,
            paddingHorizontal: 16,
          }}
        >
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
                backgroundColor: activeSection === id ? '#16a34a' : '#ffffff',
                borderWidth: activeSection === id ? 0 : 1,
                borderColor: '#E5E7EB',
              }}
            >
              <Icon size={18} color={activeSection === id ? 'white' : '#4B5563'} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: activeSection === id ? 'white' : '#374151',
                }}
              >
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
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: activeTab === id ? 'white' : '#374151',
                    }}
                  >
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
    </View>
  );
}

const styles = StyleSheet.create({
  hubContainer: {
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 16,
  },
  hubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    gap: 12,
  },
  hubCardTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  hubCardSubtitle: {
    color: '#ecfdf5',
    fontSize: 12,
    marginTop: 2,
  },
  hubRow: {
    flexDirection: 'row',
    gap: 10,
  },
  hubSmallCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    gap: 4,
  },
  hubSmallTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  hubSmallSubtitle: {
    color: '#ffffffdd',
    fontSize: 11,
  },
});
