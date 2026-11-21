import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, Crosshair, MapPin, Plus, Square, SquareCheck, Trash2, UserPlus, X } from 'lucide-react-native';
import * as Location from 'expo-location';
import { toast } from 'sonner-native';
import DateTimeField from '@/components/ui/DateTimeField';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { mentionService, type MentionCandidate } from '@/lib/services/MentionService';
import type { CoOrganizer, CoOrganizerPermission, EventRecurrenceEndMode, EventRecurrenceUnit, RegistrationQuestion, RegistrationQuestionType } from '@/types/eventTypes';

/** The website's CREATE_ACCESSIBILITY_OPTIONS (same keys, so its filters match). */
export const EVENT_FORM_ACCESSIBILITY_OPTIONS = [
  { key: 'wheelchair-access', label: 'Wheelchair accessible' },
  { key: 'sign-language', label: 'Sign language interpretation' },
  { key: 'hearing-loop', label: 'Hearing loop available' },
  { key: 'accessible-parking', label: 'Accessible parking' },
  { key: 'quiet-space', label: 'Quiet space' },
  { key: 'assistance', label: 'Assistance available' },
] as const;

const WEEKDAYS = [
  { key: 'sun', label: 'S', name: 'Sunday' }, { key: 'mon', label: 'M', name: 'Monday' }, { key: 'tue', label: 'T', name: 'Tuesday' },
  { key: 'wed', label: 'W', name: 'Wednesday' }, { key: 'thu', label: 'T', name: 'Thursday' }, { key: 'fri', label: 'F', name: 'Friday' },
  { key: 'sat', label: 'S', name: 'Saturday' },
] as const;
const RECURRENCE_UNITS: { key: EventRecurrenceUnit; label: string }[] = [{ key: 'day', label: 'Days' }, { key: 'week', label: 'Weeks' }, { key: 'month', label: 'Months' }, { key: 'year', label: 'Years' }];
const RECURRENCE_END_MODES: { key: EventRecurrenceEndMode; label: string }[] = [{ key: 'never', label: 'Never' }, { key: 'date', label: 'On a date' }, { key: 'count', label: 'After occurrences' }];
const QUESTION_TYPES: { key: RegistrationQuestionType; label: string }[] = [{ key: 'text', label: 'Short answer' }, { key: 'radio', label: 'One choice' }, { key: 'checkbox', label: 'Several choices' }, { key: 'select', label: 'Dropdown' }];
const PERMISSIONS: { key: CoOrganizerPermission; label: string }[] = [
  { key: 'manage_discussions', label: 'Discussions' }, { key: 'manage_reviews', label: 'Reviews' }, { key: 'manage_attendance', label: 'Attendance' },
];
const MAX_CO_ORGANIZERS = 10;
const MAX_QUESTIONS = 20;

export type CustomRecurrenceValue = {
  recurrenceInterval: number;
  recurrenceUnit: EventRecurrenceUnit;
  recurrenceDays: string[];
  recurrenceEndMode: EventRecurrenceEndMode;
  recurrenceEndDate: string;
  recurrenceCount: number;
};

function useSectionStyles() {
  const { colors } = useAppTheme();
  return { colors, styles: useMemo(() => createStyles(colors), [colors]) };
}

/** A titled block of the event form, like the website's EventFormSection. */
export function EventFormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const { styles } = useSectionStyles();
  return <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {description ? <Text style={styles.hint}>{description}</Text> : null}
    {children}
  </View>;
}

export function ChoiceChips<TValue extends string>({ options, value, onChange, accessibilityLabel }: { options: readonly { key: TValue; label: string }[]; value: TValue; onChange: (value: TValue) => void; accessibilityLabel: string }) {
  const { styles } = useSectionStyles();
  return <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.chips}>
    {options.map((option) => {
      const isSelected = option.key === value;
      return <TouchableOpacity key={option.key} accessibilityRole="radio" accessibilityState={{ selected: isSelected }} onPress={() => onChange(option.key)} style={[styles.chip, isSelected ? styles.chipSelected : null]}>
        <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>{option.label}</Text>
      </TouchableOpacity>;
    })}
  </View>;
}

/** Custom recurrence (the website's EventRecurrenceFields): every N units, weekdays for weekly, and when it ends. */
export function CustomRecurrenceFields({ value, eventStartDate, onChange }: { value: CustomRecurrenceValue; eventStartDate: Date | null; onChange: (value: CustomRecurrenceValue) => void }) {
  const { colors, styles } = useSectionStyles();
  const endDate = value.recurrenceEndDate ? new Date(`${value.recurrenceEndDate}T00:00:00`) : null;
  return <View style={styles.box}>
    <Text style={styles.label}>Repeat every</Text>
    <View style={styles.row}>
      <TextInput keyboardType="number-pad" value={String(value.recurrenceInterval)} accessibilityLabel="Repeat interval"
        onChangeText={(text) => onChange({ ...value, recurrenceInterval: Math.min(99, Math.max(1, Number(text.replace(/\D/g, '')) || 1)) })}
        style={[styles.input, styles.smallInput]} placeholderTextColor={colors.mutedText} />
      <View style={styles.flex}><ChoiceChips options={RECURRENCE_UNITS} value={value.recurrenceUnit} onChange={(recurrenceUnit) => onChange({ ...value, recurrenceUnit })} accessibilityLabel="Repeat unit" /></View>
    </View>
    {value.recurrenceUnit === 'week' ? <>
      <Text style={styles.label}>On</Text>
      <View style={styles.row}>
        {WEEKDAYS.map((day) => {
          const isSelected = value.recurrenceDays.includes(day.key);
          return <TouchableOpacity key={day.key} accessibilityRole="checkbox" accessibilityLabel={day.name} accessibilityState={{ checked: isSelected }}
            onPress={() => onChange({ ...value, recurrenceDays: isSelected ? value.recurrenceDays.filter((key) => key !== day.key) : [...value.recurrenceDays, day.key] })}
            style={[styles.dayChip, isSelected ? styles.chipSelected : null]}>
            <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>{day.label}</Text>
          </TouchableOpacity>;
        })}
      </View>
    </> : null}
    <Text style={styles.label}>Ends</Text>
    <ChoiceChips options={RECURRENCE_END_MODES} value={value.recurrenceEndMode} onChange={(recurrenceEndMode) => onChange({ ...value, recurrenceEndMode })} accessibilityLabel="When the repeats end" />
    {value.recurrenceEndMode === 'date' ? <DateTimeField label="Last date" mode="date" placeholder="Pick the last date" value={endDate} minimumDate={eventStartDate ?? new Date()}
      onChange={(date) => onChange({ ...value, recurrenceEndDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` })} /> : null}
    {value.recurrenceEndMode === 'count' ? <View style={styles.row}>
      <TextInput keyboardType="number-pad" value={String(value.recurrenceCount)} accessibilityLabel="Number of occurrences"
        onChangeText={(text) => onChange({ ...value, recurrenceCount: Math.min(999, Math.max(1, Number(text.replace(/\D/g, '')) || 1)) })}
        style={[styles.input, styles.smallInput]} />
      <Text style={styles.hint}>occurrences</Text>
    </View> : null}
  </View>;
}

/** In person or online, the venue or link, and the venue's coordinates (so distance filters find the event). */
export function EventLocationFields({ isVirtual, location, lat, lng, onChange }: {
  isVirtual: boolean; location: string; lat: number | null; lng: number | null;
  onChange: (changes: { isVirtual?: boolean; location?: string; lat?: number | null; lng?: number | null }) => void;
}) {
  const { colors, styles } = useSectionStyles();
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const handleGeocode = async () => {
    if (!location.trim()) { toast.error('Enter the venue address first'); return; }
    setIsGeocoding(true);
    try {
      const [result] = await Location.geocodeAsync(location.trim());
      if (!result) { toast.error('Could not find that address on the map'); return; }
      onChange({ lat: result.latitude, lng: result.longitude });
      toast.success('Venue found on the map');
    } catch (error: unknown) {
      console.error('[EventLocationFields.handleGeocode] Error:', error instanceof Error ? error.message : 'Unknown error');
      toast.error('Could not look up that address. Try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleUseMyLocation = async () => {
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) { toast.error('Allow location access to use your current location.'); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [place] = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude }).catch(() => []);
      const address = place ? [place.name, place.street, place.city ?? place.subregion, place.region].filter((part, index, parts) => Boolean(part) && parts.indexOf(part) === index).join(', ') : '';
      onChange({ lat: position.coords.latitude, lng: position.coords.longitude, ...(address ? { location: address } : {}) });
      toast.success(address ? 'Location set from your phone' : 'Coordinates set. Add the venue name.');
    } catch (error: unknown) {
      console.error('[EventLocationFields.handleUseMyLocation] Error:', error instanceof Error ? error.message : 'Unknown error');
      toast.error('Could not get your location. Enter the venue instead.');
    } finally {
      setIsLocating(false);
    }
  };

  return <View style={styles.group}>
    <ChoiceChips options={[{ key: 'in-person', label: 'In person' }, { key: 'online', label: 'Online' }] as const} value={isVirtual ? 'online' : 'in-person'}
      onChange={(mode) => onChange({ isVirtual: mode === 'online' })} accessibilityLabel="Event format" />
    <Text style={styles.label}>Location</Text>
    <TextInput value={location} onChangeText={(text) => onChange({ location: text })} placeholder={isVirtual ? 'Online platform or meeting link' : 'Venue address'}
      placeholderTextColor={colors.mutedText} style={styles.input} autoCapitalize={isVirtual ? 'none' : 'sentences'} />
    {!isVirtual ? <>
      <View style={styles.row}>
        <TouchableOpacity accessibilityRole="button" onPress={() => void handleGeocode()} disabled={isGeocoding} style={[styles.secondaryButton, styles.flex]}>
          {isGeocoding ? <ActivityIndicator size="small" color={colors.accent} /> : <MapPin size={15} color={colors.icon} />}<Text style={styles.secondaryButtonText}>Find on map</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => void handleUseMyLocation()} disabled={isLocating} style={[styles.secondaryButton, styles.flex]}>
          {isLocating ? <ActivityIndicator size="small" color={colors.accent} /> : <Crosshair size={15} color={colors.icon} />}<Text style={styles.secondaryButtonText}>{isLocating ? 'Locating…' : 'Use my location'}</Text>
        </TouchableOpacity>
      </View>
      {lat !== null && lng !== null ? <Text style={styles.success}>On the map: {lat.toFixed(2)}, {lng.toFixed(2)}</Text> : <Text style={styles.hint}>Optional: puts the event on the map so people nearby can find it.</Text>}
    </> : null}
  </View>;
}

export function EventPricingFields({ isFree, ticketPrice, onChange }: { isFree: boolean; ticketPrice: string; onChange: (changes: { isFree?: boolean; ticketPrice?: string }) => void }) {
  const { colors, styles } = useSectionStyles();
  return <View style={styles.group}>
    <ChoiceChips options={[{ key: 'free', label: 'Free' }, { key: 'paid', label: 'Paid' }] as const} value={isFree ? 'free' : 'paid'} onChange={(choice) => onChange({ isFree: choice === 'free' })} accessibilityLabel="Ticket price" />
    {!isFree ? <>
      <Text style={styles.label}>Ticket price (TT$)</Text>
      <TextInput keyboardType="decimal-pad" value={ticketPrice} onChangeText={(text) => onChange({ ticketPrice: text.replace(/[^0-9.]/g, '') })} placeholder="0.00" placeholderTextColor={colors.mutedText} style={styles.input} />
    </> : null}
  </View>;
}

export function EventAccessibilityChips({ selected, onToggle }: { selected: string[]; onToggle: (key: string) => void }) {
  const { colors, styles } = useSectionStyles();
  return <View style={styles.chips}>
    {EVENT_FORM_ACCESSIBILITY_OPTIONS.map((option) => {
      const isSelected = selected.includes(option.key);
      return <TouchableOpacity key={option.key} accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }} onPress={() => onToggle(option.key)} style={[styles.chip, isSelected ? styles.chipSelected : null]}>
        {isSelected ? <Check size={13} color={colors.selectedText} /> : null}
        <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>{option.label}</Text>
      </TouchableOpacity>;
    })}
  </View>;
}

/** Draft, Scheduled (with when to publish) or Published, as on the website. */
export function EventPublishingFields({ status, publishAt, onChange }: { status: 'draft' | 'scheduled' | 'published'; publishAt: Date | null; onChange: (changes: { status?: 'draft' | 'scheduled' | 'published'; publishAt?: Date | null }) => void }) {
  const { styles } = useSectionStyles();
  return <View style={styles.group}>
    <ChoiceChips options={[{ key: 'draft', label: 'Draft' }, { key: 'scheduled', label: 'Scheduled' }, { key: 'published', label: 'Published' }] as const} value={status} onChange={(nextStatus) => onChange({ status: nextStatus })} accessibilityLabel="Event status" />
    <Text style={styles.hint}>{status === 'draft' ? 'Only you can see a draft. Publish it later from the event.' : status === 'scheduled' ? 'The event goes public on the date you choose.' : 'Everyone can see the event as soon as you publish.'}</Text>
    {status === 'scheduled' ? <DateTimeField label="Publish on" required mode="datetime" placeholder="Pick when to publish" value={publishAt} minimumDate={new Date()} onChange={(date) => onChange({ publishAt: date })} /> : null}
  </View>;
}

export function EventAgeField({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const { colors, styles } = useSectionStyles();
  return <View style={styles.group}>
    <TextInput keyboardType="number-pad" value={value === null ? '' : String(value)} placeholder="All ages" placeholderTextColor={colors.mutedText} accessibilityLabel="Minimum age"
      onChangeText={(text) => { const digits = text.replace(/\D/g, ''); onChange(digits ? Math.min(99, Number(digits)) : null); }} style={[styles.input, styles.mediumInput]} />
    <Text style={styles.hint}>Leave empty for all ages.</Text>
  </View>;
}

/** Search members, add them as co-organizers, and choose what each can manage (website EventCoOrganizersField). */
export function EventCoOrganizersField({ ownerId, coOrganizers, onChange }: { ownerId: string | null; coOrganizers: CoOrganizer[]; onChange: (coOrganizers: CoOrganizer[]) => void }) {
  const { colors, styles } = useSectionStyles();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MentionCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(() => {
      setIsSearching(true);
      void mentionService.getFriends()
        .then(async (friends) => mentionService.combine(mentionService.matchFriends(friends, text), await mentionService.searchMembers(text, friends)))
        .then((people) => setResults(people.filter((person) => person.id !== ownerId && !coOrganizers.some((coOrganizer) => coOrganizer.userId === person.id))))
        .catch((error: unknown) => console.error('[EventCoOrganizersField.search] Error:', error instanceof Error ? error.message : 'Unknown error'))
        .then(() => setIsSearching(false));
    }, 300);
  };

  const handleAdd = (person: MentionCandidate) => {
    const name = [person.firstName, person.lastName].filter(Boolean).join(' ') || person.userName;
    onChange([...coOrganizers, { userId: person.id, name, userName: person.userName, ...(person.profileImage ? { image: person.profileImage } : {}), permissions: [] }]);
    setQuery('');
    setResults([]);
  };

  const togglePermission = (userId: string, permission: CoOrganizerPermission) => onChange(coOrganizers.map((coOrganizer) => coOrganizer.userId !== userId ? coOrganizer : {
    ...coOrganizer, permissions: coOrganizer.permissions.includes(permission) ? coOrganizer.permissions.filter((item) => item !== permission) : [...coOrganizer.permissions, permission],
  }));

  return <View style={styles.group}>
    {coOrganizers.length < MAX_CO_ORGANIZERS ? <View style={styles.row}>
      <UserPlus size={16} color={colors.icon} />
      <TextInput value={query} onChangeText={handleQueryChange} placeholder="Search people by name or username" placeholderTextColor={colors.mutedText} autoCapitalize="none" style={[styles.input, styles.flex]} />
      {isSearching ? <ActivityIndicator size="small" color={colors.accent} /> : null}
    </View> : <Text style={styles.hint}>You can add up to {MAX_CO_ORGANIZERS} co-organizers.</Text>}
    {results.length ? <View style={styles.results}>
      {results.map((person) => <TouchableOpacity key={person.id} accessibilityRole="button" accessibilityLabel={`Add ${person.userName} as a co-organizer`} onPress={() => handleAdd(person)} style={styles.resultRow}>
        <UserAvatar profileImage={person.profileImage} firstName={person.firstName || person.userName} size={30} />
        <View style={styles.flex}><Text style={styles.resultName}>{[person.firstName, person.lastName].filter(Boolean).join(' ') || person.userName}</Text><Text style={styles.hint}>@{person.userName}</Text></View>
        <Plus size={16} color={colors.accent} />
      </TouchableOpacity>)}
    </View> : null}
    {coOrganizers.map((coOrganizer) => <View key={coOrganizer.userId} style={styles.box}>
      <View style={styles.row}>
        <UserAvatar profileImage={coOrganizer.image} firstName={coOrganizer.name || coOrganizer.userName || 'Co-organizer'} size={30} />
        <View style={styles.flex}><Text style={styles.resultName}>{coOrganizer.name || coOrganizer.userName}</Text>{coOrganizer.userName ? <Text style={styles.hint}>@{coOrganizer.userName}</Text> : null}</View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${coOrganizer.name || coOrganizer.userName}`} hitSlop={10} onPress={() => onChange(coOrganizers.filter((item) => item.userId !== coOrganizer.userId))}><X size={18} color={colors.icon} /></TouchableOpacity>
      </View>
      <Text style={styles.hint}>Can manage</Text>
      <View style={styles.chips}>
        {PERMISSIONS.map((permission) => {
          const isSelected = coOrganizer.permissions.includes(permission.key);
          return <TouchableOpacity key={permission.key} accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }} onPress={() => togglePermission(coOrganizer.userId, permission.key)} style={[styles.chip, isSelected ? styles.chipSelected : null]}>
            {isSelected ? <Check size={13} color={colors.selectedText} /> : null}<Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>{permission.label}</Text>
          </TouchableOpacity>;
        })}
      </View>
    </View>)}
  </View>;
}

/** Questions attendees answer when they register (website EventRegistrationQuestionsField). */
export function EventRegistrationQuestionsField({ questions, onChange }: { questions: RegistrationQuestion[]; onChange: (questions: RegistrationQuestion[]) => void }) {
  const { colors, styles } = useSectionStyles();
  const update = (index: number, changes: Partial<RegistrationQuestion>) => onChange(questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...changes } : question));
  const handleAdd = () => onChange([...questions, { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, question: '', type: 'text', required: false }]);
  return <View style={styles.group}>
    {questions.map((question, index) => {
      const hasOptions = question.type !== 'text';
      const options = question.options ?? [];
      return <View key={question.id} style={styles.box}>
        <View style={styles.row}>
          <Text style={[styles.label, styles.flex]}>Question {index + 1}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove question ${index + 1}`} hitSlop={10} onPress={() => onChange(questions.filter((_, questionIndex) => questionIndex !== index))}><Trash2 size={17} color={colors.destructiveText} /></TouchableOpacity>
        </View>
        <TextInput value={question.question} onChangeText={(text) => update(index, { question: text })} placeholder="e.g. Any dietary needs?" placeholderTextColor={colors.mutedText} style={styles.input} />
        <ChoiceChips options={QUESTION_TYPES} value={question.type} accessibilityLabel="Answer type"
          onChange={(type) => update(index, { type, options: type === 'text' ? undefined : options.length ? options : [''] })} />
        {hasOptions ? <>
          {options.map((option, optionIndex) => <View key={`${question.id}_${optionIndex}`} style={styles.row}>
            <TextInput value={option} onChangeText={(text) => update(index, { options: options.map((item, itemIndex) => itemIndex === optionIndex ? text : item) })}
              placeholder={`Option ${optionIndex + 1}`} placeholderTextColor={colors.mutedText} style={[styles.input, styles.flex]} />
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove option ${optionIndex + 1}`} hitSlop={10} onPress={() => update(index, { options: options.filter((_, itemIndex) => itemIndex !== optionIndex) })}><X size={17} color={colors.icon} /></TouchableOpacity>
          </View>)}
          <TouchableOpacity accessibilityRole="button" onPress={() => update(index, { options: [...options, ''] })} style={styles.linkButton}><Plus size={14} color={colors.accentText} /><Text style={styles.linkText}>Add option</Text></TouchableOpacity>
        </> : null}
        <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: question.required }} onPress={() => update(index, { required: !question.required })} style={styles.row}>
          {question.required ? <SquareCheck size={18} color={colors.accent} /> : <Square size={18} color={colors.mutedText} />}<Text style={styles.chipText}>Required</Text>
        </TouchableOpacity>
      </View>;
    })}
    {questions.length < MAX_QUESTIONS ? <TouchableOpacity accessibilityRole="button" onPress={handleAdd} style={styles.secondaryButton}><Plus size={15} color={colors.icon} /><Text style={styles.secondaryButtonText}>Add a question</Text></TouchableOpacity> : null}
  </View>;
}

/** Questions without text, and choice questions without options, are dropped before saving (the website requires both). */
export function cleanRegistrationQuestions(questions: RegistrationQuestion[]): RegistrationQuestion[] {
  return questions.flatMap((question): RegistrationQuestion[] => {
    const text = question.question.trim();
    if (!text) return [];
    if (question.type === 'text') return [{ id: question.id, question: text, type: 'text', required: question.required }];
    const options = (question.options ?? []).map((option) => option.trim()).filter(Boolean);
    return options.length ? [{ id: question.id, question: text, type: question.type, required: question.required, options }] : [];
  });
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  section: { gap: 8, marginBottom: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  group: { gap: 8 },
  box: { gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  label: { fontSize: 12, fontWeight: '600', color: colors.secondaryText },
  hint: { fontSize: 12, color: colors.mutedText, lineHeight: 17 },
  success: { fontSize: 12, fontWeight: '700', color: colors.successText },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.selectedControl },
  chipText: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: colors.selectedText },
  dayChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, borderRadius: 8, paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 14 },
  smallInput: { width: 64, textAlign: 'center' },
  mediumInput: { width: 140 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  results: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  resultName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  linkText: { color: colors.accentText, fontSize: 13, fontWeight: '700' },
});
