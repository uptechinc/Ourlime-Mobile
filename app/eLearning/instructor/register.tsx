import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Check, FileText, GraduationCap, Paperclip } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { instructorService } from '@/lib/services/InstructorService';

// Same choices as the website's instructor application.
const SUBJECT_CATEGORIES = ['Information Technology', 'Science', 'Business', 'Language', 'Art', 'History', 'Mathematics', 'Engineering', 'Health Sciences', 'Social Sciences', 'CXC'];
const STUDENT_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'];
const DELIVERY_METHODS = ['Self-Paced', 'Live', 'Hybrid'];
const QUALIFICATIONS = ['High School', 'Associate Degree', "Bachelor's Degree", "Master's Degree", 'Doctorate', 'Professional Certification', 'Other'];
const CONTENT_MAX_WIDTH = 720;

const splitList = (value: string): string[] => [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))];

type ResumeFile = { uri: string; name: string; mimeType?: string };

/** "Become an instructor": the website's application in one scrolling form. An administrator verifies it. */
export default function InstructorRegisterScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(auth.currentUser?.email ?? '');
  const [jobTitle, setJobTitle] = useState('');
  const [qualification, setQualification] = useState('');
  const [years, setYears] = useState('');
  const [expertise, setExpertise] = useState('');
  const [languages, setLanguages] = useState('English');
  const [bio, setBio] = useState('');
  const [teaching, setTeaching] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [intended, setIntended] = useState('');
  const [resume, setResume] = useState<ResumeFile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const toggle = (list: string[], value: string, setList: (next: string[]) => void) => setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const handlePickResume = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > 50 * 1024 * 1024) { setErrors((current) => ({ ...current, resume: 'The CV must be smaller than 50 MB.' })); return; }
    setResume({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = 'First name is required.';
    if (!lastName.trim()) next.lastName = 'Last name is required.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!jobTitle.trim()) next.jobTitle = 'Current job title is required.';
    if (!qualification) next.qualification = 'Choose your highest qualification.';
    if (Number.isNaN(Number(years)) || Number(years) < 0) next.years = 'Enter your years of experience.';
    if (splitList(expertise).length === 0) next.expertise = 'Add at least one field of expertise.';
    if (splitList(languages).length === 0) next.languages = 'Add at least one language.';
    if (bio.trim().length < 50) next.bio = 'Write at least 50 characters about yourself.';
    if (subjects.length === 0) next.subjects = 'Choose at least one subject.';
    if (levels.length === 0) next.levels = 'Choose at least one student level.';
    if (methods.length === 0) next.methods = 'Choose at least one way to teach.';
    if (intended.trim().length < 50) next.intended = 'Describe your planned courses in at least 50 characters.';
    if (!resume) next.resume = 'Attach your CV.';
    return next;
  };

  const handleSubmit = async () => {
    const next = validate();
    setErrors(next);
    setSubmitError(null);
    if (Object.keys(next).length > 0 || !resume) return;
    setIsSubmitting(true);
    try {
      const resumeUrl = await instructorService.uploadResume(resume);
      await instructorService.apply({
        firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), bio: bio.trim(), jobTitle: jobTitle.trim(),
        highestQualification: qualification, yearsOfExperience: Math.floor(Number(years) || 0), fieldsOfExpertise: splitList(expertise),
        languagesTaught: splitList(languages), subjectCategories: subjects, studentLevels: levels, courseDeliveryMethods: methods,
        previousTeachingExperience: teaching.trim(), intendedCoursesDescription: intended.trim(), resumeUrl,
      });
      setIsDone(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      setSubmitError(message.includes('already') ? 'Your instructor profile is already verified.' : 'Your application could not be sent. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (label: string, key: string, value: string, onChange: (next: string) => void, options?: { multiline?: boolean; placeholder?: string; keyboardType?: 'email-address' | 'number-pad'; hint?: string }) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={options?.placeholder}
        placeholderTextColor={colors.mutedText}
        multiline={options?.multiline}
        keyboardType={options?.keyboardType}
        autoCapitalize={options?.keyboardType === 'email-address' ? 'none' : 'sentences'}
        style={[styles.input, options?.multiline && styles.multiline, errors[key] && styles.inputError]}
      />
      {errors[key] ? <Text style={styles.error}>{errors[key]}</Text> : options?.hint ? <Text style={styles.hint}>{options.hint}</Text> : null}
    </View>
  );

  const chips = (label: string, key: string, values: string[], selected: string[], setSelected: (next: string[]) => void) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {values.map((value) => {
          const isSelected = selected.includes(value);
          return (
            <Pressable key={value} accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }} onPress={() => toggle(selected, value, setSelected)} style={[styles.chip, isSelected && styles.chipSelected]}>
              {isSelected ? <Check size={14} color={colors.onAccent} /> : null}
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{value}</Text>
            </Pressable>
          );
        })}
      </View>
      {errors[key] ? <Text style={styles.error}>{errors[key]}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <PageHeader title="Become an instructor" onBackPress={() => router.back()} />
      {isDone ? (
        <View style={styles.done}>
          <GraduationCap size={44} color={colors.accent} />
          <Text style={styles.doneTitle}>Application sent</Text>
          <Text style={styles.doneText}>An administrator will review your profile. You can prepare courses meanwhile; publishing opens once you are verified.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/eLearning/instructor' as Href)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Go to instructor dashboard</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardSafeView style={styles.flex}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
            <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
              <Text style={styles.intro}>Tell learners who you are and what you will teach. An administrator verifies every instructor before their courses can be published.</Text>

              <Text style={styles.section}>About you</Text>
              <View style={width >= 600 ? styles.row : undefined}>
                <View style={styles.flex}>{field('First name', 'firstName', firstName, setFirstName)}</View>
                <View style={styles.flex}>{field('Last name', 'lastName', lastName, setLastName)}</View>
              </View>
              {field('Email', 'email', email, setEmail, { keyboardType: 'email-address' })}
              {field('Current job title', 'jobTitle', jobTitle, setJobTitle, { placeholder: 'e.g. Secondary school teacher' })}
              {chips('Highest qualification', 'qualification', QUALIFICATIONS, qualification ? [qualification] : [], (next) => setQualification(next.filter((value) => value !== qualification)[0] ?? ''))}
              {field('Years of experience', 'years', years, setYears, { keyboardType: 'number-pad' })}
              {field('Fields of expertise', 'expertise', expertise, setExpertise, { placeholder: 'Accounting, Excel, Business law', hint: 'Separate with commas.' })}
              {field('Languages you teach in', 'languages', languages, setLanguages, { hint: 'Separate with commas.' })}
              {field('Bio', 'bio', bio, setBio, { multiline: true, placeholder: 'Your background, teaching style and what learners can expect.' })}
              {field('Previous teaching experience (optional)', 'teaching', teaching, setTeaching, { multiline: true })}

              <Text style={styles.section}>What you will teach</Text>
              {chips('Subjects', 'subjects', SUBJECT_CATEGORIES, subjects, setSubjects)}
              {chips('Student levels', 'levels', STUDENT_LEVELS, levels, setLevels)}
              {chips('How you teach', 'methods', DELIVERY_METHODS, methods, setMethods)}
              {field('Courses you plan to offer', 'intended', intended, setIntended, { multiline: true })}

              <Text style={styles.section}>CV</Text>
              <Pressable accessibilityRole="button" onPress={() => void handlePickResume()} style={[styles.fileButton, errors.resume && styles.inputError]}>
                {resume ? <FileText size={20} color={colors.accentText} /> : <Paperclip size={20} color={colors.mutedText} />}
                <Text style={styles.fileText} numberOfLines={1}>{resume ? resume.name : 'Attach your CV (PDF or Word)'}</Text>
              </Pressable>
              {errors.resume ? <Text style={styles.error}>{errors.resume}</Text> : null}

              {Object.keys(errors).length > 0 ? <Text style={styles.error}>Please fix the highlighted fields.</Text> : null}
              {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
              <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void handleSubmit()} style={[styles.primaryButton, isSubmitting && styles.disabled]}>
                <Text style={styles.primaryButtonText}>{isSubmitting ? 'Sending application…' : 'Send application'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardSafeView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  intro: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  section: { marginTop: 8, color: colors.text, fontSize: 18, fontWeight: '900' },
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  inputError: { borderColor: colors.destructiveText },
  error: { color: colors.destructiveText, fontSize: 12 },
  hint: { color: colors.mutedText, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: colors.onAccent },
  fileButton: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  fileText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  primaryButton: { minHeight: 50, marginTop: 8, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  doneText: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
