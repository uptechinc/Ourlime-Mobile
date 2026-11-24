import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpen, ExternalLink, FileText, GraduationCap, Search, X } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { CxcHubContentSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { ELearningEmptyState, ELearningHeader, ELEARNING_ACTION_GREEN, ELEARNING_GUTTER } from '@/components/eLearning/ELearningParts';
import { courseService } from '@/lib/services/CourseService';
import type { CxcSubject } from '@/lib/types/course';

const SUBJECT_CARD_WIDTH = 156;
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

/** CSEC and CAPE revision: pick a subject, then open its past papers and solutions (web /eLearning/cxc). */
export default function CxcStudyCenterScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [subjects, setSubjects] = useState<CxcSubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<CxcSubject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openError, setOpenError] = useState('');
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase();
  // Web cxc/page.tsx search: subjects by name or code.
  const visibleSubjects = normalizedSearch
    ? subjects.filter((subject) => [subject.title, subject.code, subject.level].some((value) => value.toLocaleLowerCase().includes(normalizedSearch)))
    : subjects;

  const handleOpenPaper = (url?: string) => {
    if (!url) return;
    setOpenError('');
    void Linking.openURL(url).catch((openFailure: unknown) => {
      console.warn('[CxcStudyCenterScreen.handleOpenPaper] Error:', openFailure instanceof Error ? openFailure.message : openFailure);
      setOpenError('This paper could not be opened on your phone.');
    });
  };

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    void courseService.getCxcSubjects().then((items) => {
      if (!active) return;
      setSubjects(items);
      setSelectedSubject((current) => items.find((item) => item.id === current?.id) ?? items[0] ?? null);
    }).catch((loadError: unknown) => {
      console.error('[CxcStudyCenterScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      if (active) setError('CXC resources could not be loaded. Check your connection and try again.');
    }).then(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => load(), [load]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ELearningHeader title="CXC revision" subtitle="CSEC and CAPE past papers" onBack={() => router.back()} />

      <KeyboardSafeView style={styles.flexFill}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <View style={styles.banner}>
          <View style={styles.bannerIcon}><GraduationCap size={26} color={colors.accentText} /></View>
          <View style={styles.flexText}>
            <Text accessibilityRole="header" style={styles.bannerTitle}>CSEC & CAPE exam hub</Text>
            <Text style={styles.bannerSubtitle}>Caribbean syllabus revision guides and solved past papers.</Text>
          </View>
        </View>

        {loading ? <CxcHubContentSkeleton /> : error ? (
          <ELearningEmptyState icon={<BookOpen size={40} color={colors.mutedText} />} title="CXC resources could not load" hint={error} actionLabel="Try again" onAction={() => { load(); }} />
        ) : subjects.length === 0 ? (
          <ELearningEmptyState icon={<BookOpen size={40} color={colors.mutedText} />} title="No CXC resources yet" hint="Subjects and papers appear here when administrators publish them." />
        ) : (
          <>
            <View style={styles.searchBox}>
              <Search size={18} color={colors.mutedText} />
              <TextInput accessibilityLabel="Search subjects" value={search} onChangeText={setSearch} placeholder="Search by subject or code" placeholderTextColor={colors.mutedText} returnKeyType="search" style={styles.searchInput} />
              {search ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} android_ripple={{ ...RIPPLE, borderless: true }} style={styles.clearButton}>
                  <X size={18} color={colors.mutedText} />
                </Pressable>
              ) : null}
            </View>

            <Text accessibilityRole="header" style={styles.sectionTitle}>Choose a subject</Text>
            {visibleSubjects.length === 0 ? (
              <Text style={styles.muted}>No subjects match "{search.trim()}".</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.subjectList}>
                {visibleSubjects.map((subject) => {
                  const isSelected = selectedSubject?.id === subject.id;
                  return (
                    <Pressable
                      key={subject.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${subject.title}, ${subject.code}, ${subject.pastPapersCount} past papers`}
                      onPress={() => setSelectedSubject(subject)}
                      android_ripple={RIPPLE}
                      style={[styles.subjectCard, isSelected && styles.subjectCardSelected]}
                    >
                      <Text numberOfLines={1} style={[styles.subjectCode, isSelected && styles.onGreenMuted]}>{subject.code}</Text>
                      <Text numberOfLines={2} style={[styles.subjectTitle, isSelected && styles.onGreen]}>{subject.title}</Text>
                      <Text numberOfLines={1} style={[styles.subjectMeta, isSelected && styles.onGreenMuted]}>{subject.pastPapersCount} past {subject.pastPapersCount === 1 ? 'paper' : 'papers'}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {selectedSubject ? (
              <View style={styles.papersCard}>
                <View style={styles.papersHeader}>
                  <BookOpen size={20} color={colors.accentText} />
                  <View style={styles.flexText}>
                    <Text accessibilityRole="header" style={styles.papersTitle}>{selectedSubject.title}</Text>
                    <Text style={styles.muted}>{selectedSubject.level} · solutions and past papers</Text>
                  </View>
                </View>
                {openError ? <Text accessibilityRole="alert" style={styles.errorText}>{openError}</Text> : null}
                {selectedSubject.papers.length === 0 ? (
                  <Text style={styles.muted}>No papers for this subject yet.</Text>
                ) : selectedSubject.papers.map((paper, paperIndex) => (
                  <View key={`paper-${paperIndex}`} style={styles.paperItem}>
                    <FileText size={20} color={colors.accentText} />
                    <View style={styles.flexText}>
                      <Text numberOfLines={2} style={styles.paperTitle}>{paper.title}</Text>
                      <Text style={styles.muted}>{paper.year}</Text>
                    </View>
                    {paper.url ? (
                      <Pressable accessibilityRole="link" accessibilityLabel={`Study ${paper.title}`} onPress={() => handleOpenPaper(paper.url)} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.studyButton}>
                        <Text style={styles.studyText}>Study</Text>
                        <ExternalLink size={14} color="#ffffff" />
                      </Pressable>
                    ) : (
                      <Text accessibilityLabel={`${paper.title}: no file has been added yet`} style={styles.soonText}>No file yet</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      </KeyboardSafeView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  flexFill: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  scrollContent: { padding: ELEARNING_GUTTER, paddingBottom: 48, gap: 16 },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  errorText: { color: colors.destructiveText, fontSize: 13, lineHeight: 18 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: colors.successSurface },
  bannerIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  bannerTitle: { color: colors.successText, fontSize: 17, fontWeight: '800' },
  bannerSubtitle: { color: colors.successText, fontSize: 13, lineHeight: 18, marginTop: 2 },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, borderWidth: 1, borderRadius: 999, borderColor: colors.border, backgroundColor: colors.input },
  searchInput: { flex: 1, minHeight: 46, color: colors.text, fontSize: 16, paddingVertical: 0 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: -6 },
  subjectList: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
  subjectCard: { width: SUBJECT_CARD_WIDTH, minHeight: 104, padding: 14, gap: 4, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  subjectCardSelected: { borderColor: ELEARNING_ACTION_GREEN, backgroundColor: ELEARNING_ACTION_GREEN },
  subjectCode: { color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  subjectTitle: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  subjectMeta: { marginTop: 'auto', color: colors.mutedText, fontSize: 12 },
  onGreen: { color: '#ffffff' },
  onGreenMuted: { color: '#d1fae5' },
  papersCard: { padding: 16, gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  papersHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  papersTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  paperItem: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
  paperTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  studyButton: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
  studyText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  soonText: { color: colors.mutedText, fontSize: 12, fontWeight: '700', paddingHorizontal: 6 },
});
