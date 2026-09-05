import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  BookOpen,
  FileText,
  CheckCircle,
  GraduationCap,
} from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { courseService } from '@/lib/services/CourseService';
import type { CxcSubject } from '@/lib/types/course';

export default function CxcStudyCenterScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const subjects = courseService.getCxcSubjects();
  const [selectedSubject, setSelectedSubject] = useState<CxcSubject>(subjects[0]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.canvas }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>CXC Caribbean Revision</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <GraduationCap size={28} color="#052e16" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>CSEC & CAPE Exam Hub</Text>
            <Text style={styles.bannerSubtitle}>
              Access official Caribbean syllabus revision guides, topic checklists, and solved past papers.
            </Text>
          </View>
        </View>

        {/* Subjects Horizontal Picker */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Choose Subject</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subjectList}
        >
          {subjects.map((sub) => {
            const isSelected = selectedSubject.id === sub.id;
            return (
              <TouchableOpacity
                key={sub.id}
                onPress={() => setSelectedSubject(sub)}
                style={[
                  styles.subjectCard,
                  isSelected
                    ? { backgroundColor: '#10b981', borderColor: '#10b981' }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.subjectCode,
                    { color: isSelected ? '#ecfdf5' : '#10b981' },
                  ]}
                >
                  {sub.code}
                </Text>
                <Text
                  style={[
                    styles.subjectTitle,
                    { color: isSelected ? '#ffffff' : colors.text },
                  ]}
                >
                  {sub.title}
                </Text>
                <Text
                  style={[
                    styles.subjectMeta,
                    { color: isSelected ? '#ecfdf5' : colors.mutedText },
                  ]}
                >
                  {sub.pastPapersCount} past papers
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected Subject Revision Materials */}
        <View style={[styles.papersContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.papersHeader}>
            <BookOpen size={20} color="#10b981" />
            <Text style={[styles.papersHeaderTitle, { color: colors.text }]}>
              {selectedSubject.title} Solutions & Past Papers
            </Text>
          </View>

          <View style={styles.papersList}>
            {selectedSubject.papers.map((paper, pIdx) => (
              <View
                key={`paper-${pIdx}`}
                style={[
                  styles.paperItem,
                  { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: colors.border },
                ]}
              >
                <FileText size={20} color="#10b981" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.paperTitle, { color: colors.text }]}>{paper.title}</Text>
                  <Text style={[styles.paperYear, { color: colors.mutedText }]}>
                    {selectedSubject.level} • {paper.year}
                  </Text>
                </View>
                <TouchableOpacity style={styles.downloadBtn}>
                  <Text style={styles.downloadBtnText}>Study</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Syllabus Key Topics Checklist */}
        <View style={[styles.syllabusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.syllabusCardTitle, { color: colors.text }]}>
            High-Yield Caribbean Exam Topics
          </Text>
          {[
            'Core Definitions & Conceptual Formulations',
            'Paper 01 Speed Practice & Multiple Choice Traps',
            'Paper 02 Extended Response & Step-by-Step Marks Breakdown',
            'School-Based Assessment (SBA) Guidelines & Rubrics',
          ].map((topic, tIdx) => (
            <View key={`top-${tIdx}`} style={styles.topicRow}>
              <CheckCircle size={16} color="#10b981" />
              <Text style={[styles.topicText, { color: colors.text }]}>{topic}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
    gap: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#34d399',
    gap: 14,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff88',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    color: '#052e16',
    fontSize: 18,
    fontWeight: '900',
  },
  bannerSubtitle: {
    color: '#065f46',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  subjectList: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 4,
  },
  subjectCard: {
    width: 150,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  subjectCode: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subjectTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  subjectMeta: {
    fontSize: 11,
    marginTop: 4,
  },
  papersContainer: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  papersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  papersHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  papersList: {
    gap: 10,
  },
  paperItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  paperTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  paperYear: {
    fontSize: 12,
    marginTop: 2,
  },
  downloadBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  syllabusCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  syllabusCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topicText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
});
