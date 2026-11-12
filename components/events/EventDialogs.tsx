import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, ShieldAlert, Square, SquareCheck, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { EventRegistration } from '@/lib/services/EventEngagementService';
import type { RegistrationAnswers, RegistrationQuestion } from '@/types/eventTypes';

type DialogButton = { label: string; onPress: () => void; tone?: 'primary' | 'secondary' | 'danger'; disabled?: boolean };
type EventDialogProps = { visible: boolean; title: string; description?: string; onClose: () => void; buttons: DialogButton[]; children?: ReactNode; isBusy?: boolean };

/** A centred dialog for the event screens (the website's ModalShell), keyboard-safe for the text fields inside. */
export function EventDialog({ visible, title, description, onClose, buttons, children, isBusy }: EventDialogProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!isBusy) onClose(); }}>
      <KeyboardSafeView onKeyboardChange={setIsKeyboardOpen} style={[styles.scrim, { paddingTop: isKeyboardOpen ? insets.top : 0 }]}>
        <View style={[styles.card, isKeyboardOpen ? styles.cardKeyboard : null]}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.title}>{title}</Text>
              {description ? <Text style={styles.description}>{description}</Text> : null}
            </View>
            <TouchableOpacity accessibilityLabel="Close" hitSlop={10} disabled={isBusy} onPress={onClose}><X size={22} color={colors.icon} /></TouchableOpacity>
          </View>
          {children ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>{children}</ScrollView> : null}
          <View style={styles.footer}>
            {buttons.map((button) => (
              <TouchableOpacity
                key={button.label}
                accessibilityRole="button"
                disabled={button.disabled || isBusy}
                onPress={button.onPress}
                style={[styles.button, button.tone === 'secondary' ? styles.secondary : button.tone === 'danger' ? styles.danger : styles.primary, (button.disabled || isBusy) && styles.disabled]}
              >
                <Text style={[styles.buttonText, button.tone === 'secondary' ? styles.secondaryText : null]}>{button.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const ATTENDEE_GUIDANCE = [
  'Confirm the venue and organizer.',
  'Do not send payment outside approved checkout.',
  'Never share passwords, banking credentials, or verification codes.',
  'Review refund terms before purchasing.',
  'Tell someone you trust when attending an unfamiliar event.',
  'Report unusual payment or location changes.',
  'Contact local emergency services for immediate danger.',
];

/** "Before you register": the website's acknowledgement shown before attending an event without questions. */
export function RegistrationDisclaimerDialog({ visible, isBusy, onConfirm, onClose }: { visible: boolean; isBusy: boolean; onConfirm: () => void; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <EventDialog visible={visible} title="Before you register" onClose={onClose} isBusy={isBusy} buttons={[
      { label: 'Cancel', tone: 'secondary', onPress: onClose },
      { label: isBusy ? 'Registering…' : 'I acknowledge & register', onPress: onConfirm },
    ]}>
      <View style={styles.notice}>
        <ShieldAlert size={20} color={colors.warningText} />
        <View style={styles.flex}>
          <Text style={styles.noticeTitle}>Suggested acknowledgment</Text>
          <Text style={styles.noticeText}>I have reviewed the event description, location, schedule, pricing, refund terms, restrictions, accessibility information, and stated risks. I understand that identity verification confirms the organizer&apos;s account identity but does not mean Ourlime guarantees or endorses the event. I will follow lawful organizer and venue rules and report suspicious, misleading, or unsafe activity.</Text>
        </View>
      </View>
      <Text style={styles.label}>Guidance for attendees</Text>
      {ATTENDEE_GUIDANCE.map((guidance) => (
        <View key={guidance} style={styles.row}><Check size={16} color={colors.accent} /><Text style={styles.rowText}>{guidance}</Text></View>
      ))}
    </EventDialog>
  );
}

/** The organiser's registration questions, answered before attending (same validation as the website). */
export function RegistrationQuestionsDialog({ visible, eventTitle, questions, isBusy, onSubmit, onClose }: { visible: boolean; eventTitle: string; questions: RegistrationQuestion[]; isBusy: boolean; onSubmit: (answers: RegistrationAnswers) => void; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [answers, setAnswers] = useState<RegistrationAnswers>({});
  const [errors, setErrors] = useState<{ [questionId: string]: string }>({});
  useEffect(() => { if (visible) { setAnswers({}); setErrors({}); } }, [visible]);

  const setAnswer = (questionId: string, value: string | string[]) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setErrors((current) => { const next = { ...current }; delete next[questionId]; return next; });
  };
  const handleSubmit = () => {
    const nextErrors: { [questionId: string]: string } = {};
    questions.forEach((question) => {
      const answer = answers[question.id];
      if (question.required && (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0))) nextErrors[question.id] = 'This field is required';
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit(answers);
  };

  return (
    <EventDialog visible={visible} title={eventTitle} description="Please answer the following questions to register." onClose={onClose} isBusy={isBusy} buttons={[
      { label: 'Cancel', tone: 'secondary', onPress: onClose },
      { label: isBusy ? 'Registering…' : 'Register', onPress: handleSubmit },
    ]}>
      {questions.map((question) => {
        const answer = answers[question.id];
        const selected = Array.isArray(answer) ? answer : typeof answer === 'string' ? [answer] : [];
        return (
          <View key={question.id} style={styles.question}>
            <Text style={styles.label}>{question.question}{question.required ? <Text style={styles.required}> *</Text> : null}</Text>
            {question.type === 'text' ? (
              <TextInput value={typeof answer === 'string' ? answer : ''} onChangeText={(value) => setAnswer(question.id, value)} placeholder="Your answer" placeholderTextColor={colors.mutedText} multiline maxLength={2000} style={styles.input} />
            ) : (
              (question.options ?? []).map((option) => {
                const isChecked = selected.includes(option);
                const multiple = question.type === 'checkbox';
                return (
                  <TouchableOpacity key={option} accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityState={{ checked: isChecked }} onPress={() => setAnswer(question.id, multiple ? (isChecked ? selected.filter((item) => item !== option) : [...selected, option]) : option)} style={[styles.option, isChecked && styles.optionSelected]}>
                    {multiple ? (isChecked ? <SquareCheck size={18} color={colors.accent} /> : <Square size={18} color={colors.mutedText} />) : <View style={[styles.radio, isChecked && styles.radioSelected]} />}
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                );
              })
            )}
            {errors[question.id] ? <Text style={styles.error}>{errors[question.id]}</Text> : null}
          </View>
        );
      })}
    </EventDialog>
  );
}

/** Archive an event with an optional reason (hidden from listings, restorable later). */
export function ArchiveEventDialog({ visible, eventTitle, isBusy, isDone, onConfirm, onClose }: { visible: boolean; eventTitle: string; isBusy: boolean; isDone: boolean; onConfirm: (reason: string) => void; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reason, setReason] = useState('');
  useEffect(() => { if (visible) setReason(''); }, [visible]);
  if (isDone) {
    return <EventDialog visible={visible} title="Event archived" onClose={onClose} buttons={[{ label: 'Done', tone: 'secondary', onPress: onClose }]}><Text style={styles.text}>“{eventTitle}” is now hidden from all listings.</Text></EventDialog>;
  }
  return (
    <EventDialog visible={visible} title="Archive event" onClose={onClose} isBusy={isBusy} buttons={[
      { label: 'Cancel', tone: 'secondary', onPress: onClose },
      { label: isBusy ? 'Archiving…' : 'Archive', onPress: () => onConfirm(reason) },
    ]}>
      <Text style={styles.text}>Archive “{eventTitle}”? Archived events are hidden from all listings. You can restore them later from your admin/owner tools.</Text>
      <Text style={styles.label}>Reason (optional)</Text>
      <TextInput value={reason} onChangeText={setReason} placeholder="Why are you archiving this event?" placeholderTextColor={colors.mutedText} multiline maxLength={400} style={styles.input} />
    </EventDialog>
  );
}

/** Cancel (soft-delete) an event; with attendees the organiser must confirm that they will be notified, as on the website. */
export function CancelEventDialog({ visible, eventTitle, attendeeCount, isBusy, isDone, onConfirm, onClose }: { visible: boolean; eventTitle: string; attendeeCount: number; isBusy: boolean; isDone: boolean; onConfirm: () => void; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { if (visible) setConfirmed(false); }, [visible]);
  if (isDone) {
    return <EventDialog visible={visible} title="Event cancelled" onClose={onClose} buttons={[{ label: 'Done', tone: 'secondary', onPress: onClose }]}><Text style={styles.text}>“{eventTitle}” was cancelled and is hidden from listings. The event record is kept for review.</Text></EventDialog>;
  }
  return (
    <EventDialog visible={visible} title="Cancel event" onClose={onClose} isBusy={isBusy} buttons={[
      { label: 'Keep event', tone: 'secondary', onPress: onClose },
      { label: isBusy ? 'Cancelling…' : 'Cancel event', tone: 'danger', disabled: attendeeCount > 0 && !confirmed, onPress: onConfirm },
    ]}>
      <Text style={styles.text}>This marks “{eventTitle}” as cancelled (it will be hidden from listings), notifies attendees, and preserves the event record. It can be reviewed in admin history.</Text>
      {attendeeCount > 0 ? (
        <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed((current) => !current)} style={styles.notice}>
          {confirmed ? <SquareCheck size={20} color={colors.destructiveText} /> : <Square size={20} color={colors.destructiveText} />}
          <Text style={[styles.noticeText, styles.flex]}>{attendeeCount} {attendeeCount === 1 ? 'person is' : 'people are'} attending. I understand attendees will be notified that this event is cancelled.</Text>
        </TouchableOpacity>
      ) : null}
    </EventDialog>
  );
}

/** Organisers' view of attendees' answers to the registration questions. */
export function RegistrationsDialog({ visible, questions, registrations, onClose }: { visible: boolean; questions: RegistrationQuestion[]; registrations: EventRegistration[]; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const format = (value: RegistrationAnswers[string] | undefined): string => (Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value || '—');
  return (
    <EventDialog visible={visible} title="Registrations" description={`${registrations.length} ${registrations.length === 1 ? 'registration' : 'registrations'} with answers`} onClose={onClose} buttons={[{ label: 'Close', tone: 'secondary', onPress: onClose }]}>
      {registrations.length === 0 ? <Text style={styles.text}>No one has answered the registration questions yet.</Text> : registrations.map((registration) => (
        <View key={registration.userId} style={styles.registration}>
          <View style={styles.row}>
            <UserAvatar profileImage={registration.image} firstName={registration.name} size={32} />
            <Text style={[styles.label, styles.flex]}>{registration.name}</Text>
          </View>
          {questions.map((question) => (
            <View key={question.id} style={styles.answer}>
              <Text style={styles.answerQuestion}>{question.question}</Text>
              <Text style={styles.text}>{format(registration.answers[question.id])}</Text>
            </View>
          ))}
        </View>
      ))}
    </EventDialog>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'center', paddingHorizontal: 16 },
  card: { maxHeight: '88%', backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden' },
  cardKeyboard: { maxHeight: '100%', flexShrink: 1 },
  header: { flexDirection: 'row', gap: 12, padding: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  flex: { flex: 1 },
  title: { color: colors.text, fontSize: 18, fontWeight: '900' },
  description: { color: colors.mutedText, fontSize: 13, marginTop: 4 },
  body: { padding: 18, gap: 12 },
  footer: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: colors.border },
  button: { flex: 1, minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.control },
  danger: { backgroundColor: colors.destructive },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontWeight: '900', fontSize: 14, textAlign: 'center' },
  secondaryText: { color: colors.text },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.warningSurface },
  noticeTitle: { color: colors.text, fontWeight: '900', marginBottom: 4 },
  noticeText: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  label: { color: colors.text, fontWeight: '800', fontSize: 14 },
  required: { color: colors.destructiveText },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { flex: 1, color: colors.secondaryText, fontSize: 13 },
  text: { color: colors.secondaryText, fontSize: 14, lineHeight: 20 },
  question: { gap: 8 },
  input: { minHeight: 46, maxHeight: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, textAlignVertical: 'top' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  optionText: { flex: 1, color: colors.text, fontSize: 14 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.mutedText },
  radioSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  error: { color: colors.destructiveText, fontSize: 12 },
  registration: { gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  answer: { gap: 2 },
  answerQuestion: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
});
