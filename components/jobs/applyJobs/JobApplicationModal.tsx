import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  X,
  FileText,
  CheckCircle,
} from 'lucide-react-native';
// Firebase disabled for now – uncomment & configure when ready
// import { storage, db, auth } from '@/lib/firebaseConfig';
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Question {
  id: string;
  question: string;
  type: 'input' | 'checkbox' | 'dropdown';
  options?: string[];
}

interface JobApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: {
    id: string;
    basic_info: { title: string };
    category_specific: { name: string };
    creator: { name: string; profileImage?: string; email: string };
    questions?: Question[];
  };
  jobType: 'professional' | 'quicktasks' | 'freelance';
}

export default function JobApplicationModal({
  isOpen,
  onClose,
  job,
  jobType,
}: JobApplicationModalProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState<string | null>(null); // path / uri
  const [portfolioLink, setPortfolioLink] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = 3;

  const handleAnswerChange = (
    questionId: string,
    value: string | string[],
  ) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return coverLetter.trim().length >= 100;
      case 2:
        return Boolean(resumeFile);
      case 3:
        return (
          (job.questions?.length ?? 0) > 0 &&
          Object.keys(answers).length === job.questions?.length
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => (prev < 3 ? (prev + 1) as 2 | 3 : prev));
    } else {
      // Replace with your Toast lib of choice
      console.warn('Please complete all required fields.');
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => (prev > 1 ? (prev - 1) as 1 | 2 : prev));
  };

  const handleFilePick = async () => {
    // 👉🏾 Use any picker you prefer, e.g. expo-document-picker
    // const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    // if (result.type === 'success') setResumeFile(result.uri);
    console.warn('Document picker not wired yet.');
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    setIsSubmitting(true);

    try {
      /* ========= TODO / Firebase upload & submit ==============
      let resumeUrl = '';
      if (resumeFile) {
        const filename = resumeFile.split('/').pop()!;
        const storageRef = ref(storage, `applications/${auth.currentUser?.uid}/${filename}`);
        const fileBlob = await fetch(resumeFile).then(r => r.blob());
        const uploadResult = await uploadBytes(storageRef, fileBlob);
        resumeUrl = await getDownloadURL(uploadResult.ref);
      }

      const applicationData = {
        userId: auth.currentUser?.uid,
        jobId: job.id,
        jobType,
        coverLetter,
        resumeUrl,
        portfolioLink: portfolioLink || null,
        answers,
      };
      // send to your API / Firestore
      =========================================================*/
      console.log('🚀 SUBMIT PAYLOAD', {
        jobType,
        coverLetter,
        resumeFile,
        portfolioLink,
        answers,
      });
      // Replace with toast success
      console.log('Application submitted successfully!');
      onClose();
    } catch (err) {
      console.error('Submission error', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !job) return null;

  /* ---------- UI helpers ---------- */
  const StepDot = ({ step }: { step: 1 | 2 | 3 }) => {
    const bg =
      currentStep === step
        ? styles.stepActive
        : currentStep > step
        ? styles.stepDone
        : styles.stepInactive;
    return (
      <View style={[styles.stepCircle, bg]}>
        {currentStep > step ? (
          <CheckCircle size={14} color="#01eb53" />
        ) : (
          <Text style={styles.stepNumber}>{step}</Text>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      onRequestClose={onClose}
      transparent
    >
      {/* Backdrop */}
      <TouchableOpacity style={{
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  }} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} />
          </TouchableOpacity>

          <Text style={styles.title}>{job.basic_info.title}</Text>
          <Text style={styles.subTitle}>{job.category_specific.name}</Text>

          {/* Progress */}
          <View style={styles.progressRow}>
            {[1, 2, 3].map(s => (
              <React.Fragment key={s}>
                <StepDot step={s as 1 | 2 | 3} />
                {s < 3 && (
                  <View
                    style={[
                      styles.stepLine,
                      currentStep > s && { backgroundColor: '#10B981' },
                    ]}
                  />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Body */}
        <ScrollView contentContainerStyle={styles.content}>
          {currentStep === 1 && (
            <>
              <Text style={styles.sectionTitle}>Cover Letter</Text>
              <Text style={styles.sectionHint}>
                Tell us why you’re the perfect fit for this role.
              </Text>
              <TextInput
                value={coverLetter}
                onChangeText={setCoverLetter}
                placeholder="Write your cover letter here..."
                multiline
                style={styles.textArea}
              />
              <Text style={styles.charCount}>
                {coverLetter.length} / 100 characters
              </Text>
            </>
          )}

          {currentStep === 2 && (
            <>
              <Text style={styles.sectionTitle}>Resume Upload</Text>
              <TouchableOpacity
                style={styles.uploadBox}
                onPress={handleFilePick}
              >
                {resumeFile ? (
                  <>
                    <FileText size={32} color="#10B981" />
                    <Text style={styles.uploadName}>
                      {resumeFile.split('/').pop()}
                    </Text>
                    <Text style={styles.uploadHint}>Tap to change file</Text>
                  </>
                ) : (
                  <>
                    <FileText size={32} color="#9CA3AF" />
                    <Text style={styles.uploadName}>Tap to pick file</Text>
                    <Text style={styles.uploadHint}>PDF / DOC / DOCX</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                Portfolio Link (optional)
              </Text>
              <TextInput
                value={portfolioLink}
                onChangeText={setPortfolioLink}
                placeholder="https://your-portfolio.com"
                style={styles.input}
                autoCapitalize="none"
                keyboardType={Platform.OS === 'ios' ? 'url' : 'default'}
              />
            </>
          )}

          {currentStep === 3 && (
            <>
              <Text style={styles.sectionTitle}>Screening Questions</Text>
              {job.questions?.map(q => (
                <View key={q.id} style={styles.questionBox}>
                  <Text style={styles.questionLabel}>{q.question}</Text>

                  {q.type === 'input' && (
                    <TextInput
                      placeholder="Your answer"
                      style={styles.input}
                      onChangeText={v => handleAnswerChange(q.id, v)}
                    />
                  )}

                  {q.type === 'dropdown' && (
                    <View style={styles.dropdown}>
                      {q.options?.map(opt => (
                        <TouchableOpacity
                          key={opt}
                          style={styles.dropdownItem}
                          onPress={() => handleAnswerChange(q.id, opt)}
                        >
                          <Text>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {q.type === 'checkbox' && (
                    q.options?.map(opt => {
                      const selected = (answers[q.id] as string[] | undefined)?.includes(opt);
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[
                            styles.checkboxRow,
                            selected && styles.checkboxRowSelected,
                          ]}
                          onPress={() => {
                            const arr = (answers[q.id] as string[]) || [];
                            const newArr = selected
                              ? arr.filter(a => a !== opt)
                              : [...arr, opt];
                            handleAnswerChange(q.id, newArr);
                          }}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              selected && styles.checkboxChecked,
                            ]}
                          />
                          <Text>{opt}</Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextBtn,
              !validateCurrentStep() && { opacity: 0.5 },
            ]}
            disabled={!validateCurrentStep() || isSubmitting}
            onPress={currentStep === totalSteps ? handleSubmit : handleNext}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator color="#FFF" />
                <Text style={styles.nextText}>Submitting...</Text>
              </>
            ) : (
              <Text style={styles.nextText}>
                {currentStep === totalSteps ? 'Submit Application' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    padding: 20,
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
    top: 16,
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
  },
  subTitle: {
    textAlign: 'center',
    color: '#4B5563',
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActive: {
    backgroundColor: '#10B981',
  },
  stepDone: {
    backgroundColor: '#D1FAE5',
  },
  stepInactive: {
    backgroundColor: '#F3F4F6',
  },
  stepNumber: { color: '#FFF', fontWeight: '600' },
  stepLine: {
    width: 48,
    height: 2,
    backgroundColor: '#E5E7EB',
  },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionHint: { color: '#6B7280', marginBottom: 12 },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  charCount: {
    alignSelf: 'flex-end',
    marginTop: 4,
    color: '#6B7280',
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 32,
    alignItems: 'center',
  },
  uploadName: { fontWeight: '600', color: '#111827', marginTop: 8 },
  uploadHint: { fontSize: 12, color: '#6B7280' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  questionBox: {
    marginTop: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  questionLabel: { fontWeight: '500', marginBottom: 8 },
  dropdown: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  checkboxRowSelected: { backgroundColor: '#ECFDF5', borderRadius: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 4,
    marginRight: 8,
  },
  checkboxChecked: { backgroundColor: '#10B981', borderColor: '#10B981' },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  backBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backText: { fontWeight: '600', color: '#111827' },
  nextBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  nextText: { color: '#FFF', fontWeight: '600' },
});
