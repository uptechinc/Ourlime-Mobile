import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import DateTimeField from '@/components/ui/DateTimeField';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { childSafetyReportService } from '@/lib/services/ChildSafetyReportService';
import { supportTicketService, type SupportImageDraft } from '@/lib/services/SupportTicketService';
import {
  CHILD_SAFETY_CATEGORIES,
  CHILD_SAFETY_CATEGORY_LABELS,
  type ChildSafetyCategory,
  type ChildSafetyDangerAnswer,
  type ChildSafetyIncidentDetails,
  type ChildSafetyReportTarget,
  type ChildSafetyValidationField,
  type ReportedAccountReference,
} from '@/lib/types/childSafety';

type CommunicationChannel = ChildSafetyIncidentDetails['communicationChannel'];
type ChildAgeRange = ChildSafetyIncidentDetails['approximateChildAgeRange'];
type ReporterRelationship = ChildSafetyIncidentDetails['reporterRelationship'];
type ChoiceOption<TValue extends string> = { value: TValue; label: string };

const CHANNEL_OPTIONS: ChoiceOption<CommunicationChannel>[] = [
  { value: 'ourlime', label: 'Ourlime' },
  { value: 'in_person', label: 'In person' },
  { value: 'phone_text', label: 'Phone or text' },
  { value: 'external_platform', label: 'External platform' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'other', label: 'Other' },
];
const AGE_OPTIONS: ChoiceOption<ChildAgeRange>[] = (['under_5', '5_8', '9_12', '13_15', '16_17', 'unknown'] as const).map((value) => ({ value, label: value.replaceAll('_', '–') }));
const RELATIONSHIP_OPTIONS: ChoiceOption<ReporterRelationship>[] = (['self', 'parent_guardian', 'family_friend', 'educator_professional', 'bystander', 'unknown', 'other'] as const).map((value) => ({ value, label: value.replaceAll('_', ' ') }));

/** Same limits as the website's evidence upload: JPG/PNG/WebP/HEIC, 10 MB each, five images, 25 MB combined. */
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

/** `datetime-local` style value ("2026-11-11T14:30"), the format the website stores for `occurredAt`. */
function toLocalDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type ChildSafetyReportWizardProps = { target: ChildSafetyReportTarget };
export default function ChildSafetyReportWizard({ target }: ChildSafetyReportWizardProps) {
  const descriptionRef = useRef<TextInput>(null);
  const router = useRouter();
  const { colors } = useAppTheme();
  const [validationField, setValidationField] = useState<ChildSafetyValidationField | null>(null);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<ChildSafetyCategory | null>(null);
  const [danger, setDanger] = useState<ChildSafetyDangerAnswer>('unsure');
  const [accounts, setAccounts] = useState<ReportedAccountReference[]>(target.ownerUserId ? [{ userId: target.ownerUserId, userName: '', displayName: 'Preselected account', profileImage: null, primary: true }] : []);
  const [accountQuery, setAccountQuery] = useState('');
  const [results, setResults] = useState<ReportedAccountReference[]>([]);
  const [searching, setSearching] = useState(false);
  const [links, setLinks] = useState<string[]>(target.routePath ? [target.routePath] : []);
  const [newLink, setNewLink] = useState('');
  const [occurredAt, setOccurredAt] = useState<Date | null>(null);
  const [ongoing, setOngoing] = useState(false);
  const [channel, setChannel] = useState<CommunicationChannel>('ourlime');
  const [ageRange, setAgeRange] = useState<ChildAgeRange>('unknown');
  const [relationship, setRelationship] = useState<ReporterRelationship>('unknown');
  const [continuedRisk, setContinuedRisk] = useState<ChildSafetyDangerAnswer>('unsure');
  const [description, setDescription] = useState('');
  const [allowContact, setAllowContact] = useState(true);
  const [goodFaith, setGoodFaith] = useState(false);
  const [evidenceAcknowledged, setEvidenceAcknowledged] = useState(false);
  const [images, setImages] = useState<SupportImageDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');
  const [evidenceWarning, setEvidenceWarning] = useState('');
  const blockedAttachments = category === 'suspected_child_sexual_abuse_material' || category === 'child_sexual_abuse_or_exploitation';
  const totalBytes = useMemo(() => images.reduce((sum, image) => sum + image.byteSize, 0), [images]);

  const handleSearch = async () => {
    if (accountQuery.trim().length < 2) return;
    setSearching(true);
    try {
      setResults(await childSafetyReportService.searchReportedAccounts(accountQuery.trim()));
    } catch (error: unknown) {
      Alert.alert('Search unavailable', error instanceof Error ? error.message : 'Accounts could not be searched.');
    } finally {
      setSearching(false);
    }
  };
  const handleAddAccount = (account: ReportedAccountReference) => {
    if (accounts.length >= 5 || accounts.some((selected) => selected.userId === account.userId)) return;
    setAccounts((current) => [...current, { ...account, primary: current.length === 0 }]);
  };
  const handleRemoveAccount = (userId: string) => setAccounts((current) => current.filter((item) => item.userId !== userId).map((item, itemIndex) => ({ ...item, primary: itemIndex === 0 })));
  const handleAddLink = () => {
    if (!newLink.trim()) return;
    setLinks((current) => [...current, newLink.trim()].slice(0, 20));
    setNewLink('');
  };
  const handlePickImages = async () => {
    if (blockedAttachments) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo permission needed', 'Allow photo access to attach safe screenshots.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5, quality: 1 });
    if (result.canceled) return;
    const drafts = result.assets.map((asset, index): SupportImageDraft => ({ uri: asset.uri, fileName: asset.fileName || `safety-evidence-${index + 1}.jpg`, mediaType: asset.mimeType || 'image/jpeg', byteSize: asset.fileSize || 0 }));
    if (drafts.some((image) => image.byteSize <= 0)) return Alert.alert('Image unavailable', 'One or more images did not provide a valid size.');
    const accepted = drafts.filter((image) => ALLOWED_IMAGE_TYPES.has(image.mediaType) && image.byteSize <= MAX_IMAGE_BYTES).slice(0, 5);
    if (accepted.length < drafts.length) Alert.alert('Some images skipped', 'Only JPG, PNG, WebP or HEIC images up to 10 MB each can be attached.');
    if (accepted.reduce((sum, image) => sum + image.byteSize, 0) > MAX_TOTAL_BYTES) return Alert.alert('Images too large', 'Images may not exceed 25 MB combined.');
    setImages(accepted);
  };
  const handleSubmit = async () => {
    const validation = childSafetyReportService.validate({ category, description, goodFaithAcknowledged: goodFaith, hasAttachments: images.length > 0 && !blockedAttachments, evidenceAcknowledged });
    if (!validation.valid) {
      setValidationField(validation.field);
      setStep(validation.step);
      Alert.alert('Complete required detail', validation.message);
      if (validation.field === 'description') setTimeout(() => descriptionRef.current?.focus(), 150);
      return;
    }
    if (!category) return;
    setValidationField(null);
    setBusy(true);
    try {
      const report = await childSafetyReportService.submit({
        category,
        description,
        immediateDanger: danger,
        goodFaithAcknowledged: goodFaith,
        allowContact,
        target: { ...target, ownerUserId: accounts[0]?.userId ?? target.ownerUserId },
        additionalTargets: links.filter(Boolean).map((routePath, index) => ({ type: 'other', id: `link-${index + 1}`, routePath })),
        reportedAccounts: accounts,
        incidentDetails: { occurredAt: occurredAt ? toLocalDateTimeValue(occurredAt) : '', ongoing, communicationChannel: channel, approximateChildAgeRange: ageRange, reporterRelationship: relationship, continuedContactRisk: continuedRisk },
        evidenceContainsNoSuspectedCsam: evidenceAcknowledged,
      });
      if (images.length && !blockedAttachments) {
        try {
          const attachmentIds = await supportTicketService.uploadImages(report.id, images, 'child_safety', evidenceAcknowledged);
          await childSafetyReportService.sendMessage(report.id, 'Reporter provided image evidence with the initial report.', attachmentIds);
        } catch (uploadError: unknown) {
          console.warn('[ChildSafetyReportWizard] Error:', uploadError instanceof Error ? uploadError.message : 'Evidence upload failed.');
          setEvidenceWarning('The report was saved, but its image evidence could not be attached. Add it from the secure case conversation.');
        }
      }
      setReference(report.reference);
    } catch (error: unknown) {
      Alert.alert('Report not submitted', error instanceof Error ? error.message : 'The report could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  if (reference) {
    return (
      <View style={{ padding: 20, borderRadius: 20, backgroundColor: colors.successSurface, alignItems: 'center' }}>
        <Ionicons name="checkmark-circle" size={44} color={colors.accent} />
        <Text style={{ marginTop: 10, color: colors.text, fontSize: 20, fontWeight: '900' }}>Report securely received</Text>
        <Text style={{ marginTop: 7, color: colors.secondaryText }}>Reference <Text style={{ fontWeight: '900', fontFamily: 'monospace' }}>{reference}</Text></Text>
        {evidenceWarning ? <Text style={{ marginTop: 12, padding: 12, borderRadius: 13, color: colors.warningText, backgroundColor: colors.warningSurface, lineHeight: 19 }}>{evidenceWarning}</Text> : null}
        <TouchableOpacity onPress={() => router.replace('/help/child-safety/reports' as Href)} style={{ alignSelf: 'stretch', marginTop: 16, padding: 13, borderRadius: 14, alignItems: 'center', backgroundColor: colors.accent }}>
          <Text style={{ color: '#fff', fontWeight: '900' }}>Open My Safety Reports</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Ionicons name="shield-half" size={24} color={colors.destructive} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: colors.destructiveText, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>RESTRICTED REPORT · STEP {step} OF 4</Text>
          <Text style={{ marginTop: 5, color: colors.text, fontSize: 22, fontWeight: '900' }}>Report a child-safety concern</Text>
        </View>
      </View>
      <View style={{ marginTop: 13, height: 7, borderRadius: 99, overflow: 'hidden', backgroundColor: colors.border }}>
        <View style={{ width: `${step * 25}%`, height: 7, backgroundColor: colors.destructive }} />
      </View>

      {step === 1 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: '900' }}>Concern and immediate danger</Text>
          {CHILD_SAFETY_CATEGORIES.map((value) => (
            <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ selected: category === value }} onPress={() => { setCategory(value); if (value === 'suspected_child_sexual_abuse_material' || value === 'child_sexual_abuse_or_exploitation') setImages([]); }} style={{ marginTop: 7, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: category === value ? colors.destructive : colors.border, backgroundColor: category === value ? colors.destructiveSurface : colors.surface }}>
              <Text style={{ color: category === value ? colors.destructiveText : colors.secondaryText, fontWeight: '800' }}>{CHILD_SAFETY_CATEGORY_LABELS[value]}</Text>
            </TouchableOpacity>
          ))}
          <Question label="Is anyone in immediate danger?" value={danger} onChange={setDanger} colors={colors} />
          {danger === 'yes' ? <Text style={{ marginTop: 10, padding: 12, borderRadius: 13, color: colors.destructiveText, backgroundColor: colors.destructiveSurface, lineHeight: 20, fontWeight: '800' }}>Contact local emergency services now. Ourlime reporting does not replace emergency assistance.</Text> : null}
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: '900' }}>Reported accounts and content</Text>
          <Text style={{ marginTop: 5, color: colors.mutedText, lineHeight: 19 }}>Choose one primary account and up to four additional accounts. Exact username matches can resolve private or blocked accounts solely for this report.</Text>
          <Label text="Find an account" colors={colors} />
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TextInput value={accountQuery} onChangeText={setAccountQuery} onSubmitEditing={() => void handleSearch()} returnKeyType="search" autoCapitalize="none" placeholder="Username or name" placeholderTextColor={colors.mutedText} style={[inputStyle(colors), { flex: 1 }]} />
            <TouchableOpacity accessibilityLabel="Search accounts" disabled={searching || accountQuery.trim().length < 2} onPress={() => void handleSearch()} style={{ width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.accent, opacity: searching || accountQuery.trim().length < 2 ? 0.45 : 1 }}>
              {searching ? <ActivityIndicator color="#fff" /> : <Ionicons name="search" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
          {results.map((account) => (
            <TouchableOpacity key={account.userId} onPress={() => handleAddAccount(account)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>{account.displayName}</Text>
                <Text style={{ color: colors.mutedText, fontSize: 12 }}>@{account.userName}</Text>
              </View>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '900' }}>{accounts.some((selected) => selected.userId === account.userId) ? 'Added' : 'Add'}</Text>
            </TouchableOpacity>
          ))}
          {accounts.map((account, index) => (
            <View key={account.userId} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7, padding: 11, borderRadius: 12, backgroundColor: colors.successSurface }}>
              <Text style={{ flex: 1, color: colors.secondaryText, fontWeight: '800' }}>{index === 0 ? 'Primary · ' : ''}{account.displayName}{account.userName ? ` · @${account.userName}` : ''}</Text>
              <TouchableOpacity accessibilityLabel={`Remove ${account.displayName}`} hitSlop={8} onPress={() => handleRemoveAccount(account.userId)}>
                <Ionicons name="trash" size={18} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ))}
          <Label text="Ourlime content link" colors={colors} />
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TextInput value={newLink} onChangeText={setNewLink} onSubmitEditing={handleAddLink} autoCapitalize="none" keyboardType="url" placeholder="https://ourlime… or an app route" placeholderTextColor={colors.mutedText} style={[inputStyle(colors), { flex: 1 }]} />
            <TouchableOpacity disabled={!newLink.trim()} onPress={handleAddLink} style={{ paddingHorizontal: 15, justifyContent: 'center', borderRadius: 13, backgroundColor: colors.accent, opacity: newLink.trim() ? 1 : 0.45 }}>
              <Text style={{ color: '#fff', fontWeight: '900' }}>Add link</Text>
            </TouchableOpacity>
          </View>
          {links.map((link, index) => (
            <View key={`${link}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, padding: 8, borderRadius: 10, backgroundColor: colors.surface }}>
              <Text style={{ flex: 1, color: colors.mutedText, fontSize: 11 }}>{link}</Text>
              <TouchableOpacity accessibilityLabel="Remove link" hitSlop={8} onPress={() => setLinks((current) => current.filter((_, linkIndex) => linkIndex !== index))}>
                <Ionicons name="close" size={16} color={colors.mutedText} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: '900' }}>Incident details</Text>
          <View style={{ marginTop: 13 }}>
            <DateTimeField label="When did this happen?" value={occurredAt} onChange={setOccurredAt} mode="datetime" placeholder="Approximate date and time" onClear={() => setOccurredAt(null)} />
          </View>
          <Choice label="Communication channel" value={channel} options={CHANNEL_OPTIONS} onChange={setChannel} colors={colors} />
          <Choice label="Approximate child age" value={ageRange} options={AGE_OPTIONS} onChange={setAgeRange} colors={colors} />
          <Choice label="Your relationship" value={relationship} options={RELATIONSHIP_OPTIONS} onChange={setRelationship} colors={colors} />
          <Toggle checked={ongoing} onPress={() => setOngoing((current) => !current)} label="The concern is ongoing" colors={colors} />
          <Question label="Is continued contact a risk?" value={continuedRisk} onChange={setContinuedRisk} colors={colors} />
          <Label text="Describe what happened *" colors={colors} />
          <TextInput ref={descriptionRef} value={description} onChangeText={(value) => { setDescription(value); setValidationField(null); }} multiline maxLength={5000} placeholder="Give enough context for a reviewer. Do not include a child's legal name or unnecessary identifying details." placeholderTextColor={colors.mutedText} style={[inputStyle(colors), { minHeight: 140, paddingTop: 12, textAlignVertical: 'top', borderColor: validationField === 'description' ? colors.destructive : colors.border }]} />
          <Text style={{ marginTop: 5, color: description.trim().length >= 20 ? colors.mutedText : colors.warningText, fontSize: 11 }}>At least 20 characters · {description.trim().length}/5000</Text>
        </View>
      ) : null}

      {step === 4 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: '900' }}>Evidence and contact</Text>
          <Text style={{ marginTop: 10, padding: 12, borderRadius: 13, color: colors.warningText, backgroundColor: colors.warningSurface, lineHeight: 19, fontWeight: '800' }}>Never download, copy, forward, email, upload, or redistribute suspected CSAM. Ourlime retains the selected target identifiers automatically.</Text>
          {blockedAttachments ? (
            <Text style={{ marginTop: 10, padding: 12, borderRadius: 13, color: colors.destructiveText, backgroundColor: colors.destructiveSurface, lineHeight: 19 }}>Image attachments are disabled for this category. Do not upload suspected material.</Text>
          ) : (
            <>
              <TouchableOpacity onPress={() => void handlePickImages()} style={{ marginTop: 12, padding: 16, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center' }}>
                <Ionicons name="images" size={23} color={colors.accent} />
                <Text style={{ marginTop: 6, color: colors.secondaryText, fontWeight: '900' }}>Upload up to five safe images</Text>
                <Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 11, textAlign: 'center' }}>JPG, PNG, WebP or HEIC · up to 10 MB each, 25 MB total</Text>
              </TouchableOpacity>
              {images.length ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                  <Text style={{ flex: 1, color: colors.mutedText, fontSize: 12 }}>{images.length} {images.length === 1 ? 'image' : 'images'} · {(totalBytes / 1024 / 1024).toFixed(1)} MB</Text>
                  <TouchableOpacity hitSlop={8} onPress={() => { setImages([]); setEvidenceAcknowledged(false); }}>
                    <Text style={{ color: colors.destructive, fontSize: 12, fontWeight: '900' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <Toggle checked={evidenceAcknowledged} onPress={() => setEvidenceAcknowledged((current) => !current)} label="I confirm these images do not contain suspected CSAM." colors={colors} highlighted={validationField === 'evidence'} />
            </>
          )}
          <Toggle checked={allowContact} onPress={() => setAllowContact((current) => !current)} label="Allow Ourlime to contact me" description="Replies arrive in the secure case conversation." colors={colors} />
          <Toggle checked={goodFaith} onPress={() => setGoodFaith((current) => !current)} label="I confirm this report is accurate to the best of my knowledge and submitted in good faith." colors={colors} highlighted={validationField === 'good_faith'} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 9, marginTop: 19, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TouchableOpacity disabled={step === 1 || busy} onPress={() => setStep((current) => current - 1)} style={{ flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: colors.border, opacity: step === 1 ? 0.4 : 1 }}>
          <Text style={{ color: colors.secondaryText, fontWeight: '900' }}>Back</Text>
        </TouchableOpacity>
        {step < 4 ? (
          <TouchableOpacity disabled={step === 1 && !category} onPress={() => setStep((current) => current + 1)} style={{ flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.destructive, opacity: step === 1 && !category ? 0.4 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity disabled={busy} onPress={() => void handleSubmit()} style={{ flex: 1, flexDirection: 'row', gap: 7, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.destructive, opacity: busy ? 0.7 : 1 }}>
            {busy ? <ActivityIndicator color="#fff" /> : null}
            <Text style={{ color: '#fff', fontWeight: '900' }}>{busy ? 'Submitting…' : 'Submit restricted report'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function inputStyle(colors: AppThemeColors) {
  return { minHeight: 48, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text };
}

type LabelProps = { text: string; colors: AppThemeColors };
function Label({ text, colors }: LabelProps) {
  return <Text style={{ marginTop: 13, marginBottom: 6, color: colors.secondaryText, fontWeight: '900' }}>{text}</Text>;
}

type ToggleProps = { checked: boolean; onPress: () => void; label: string; description?: string; colors: AppThemeColors; highlighted?: boolean };
function Toggle({ checked, onPress, label, description, colors, highlighted = false }: ToggleProps) {
  return (
    <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: highlighted ? colors.destructive : colors.border, backgroundColor: colors.surface }}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.accent : colors.icon} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={{ color: colors.secondaryText, lineHeight: 19 }}>{label}</Text>
        {description ? <Text style={{ marginTop: 2, color: colors.mutedText, fontSize: 12 }}>{description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

type QuestionProps = { label: string; value: ChildSafetyDangerAnswer; onChange: (value: ChildSafetyDangerAnswer) => void; colors: AppThemeColors };
function Question({ label, value, onChange, colors }: QuestionProps) {
  return (
    <View style={{ marginTop: 13 }}>
      <Text style={{ color: colors.secondaryText, fontWeight: '900' }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 7, marginTop: 7 }}>
        {(['yes', 'no', 'unsure'] as const).map((answer) => (
          <TouchableOpacity key={answer} onPress={() => onChange(answer)} style={{ flex: 1, padding: 10, alignItems: 'center', borderRadius: 12, backgroundColor: value === answer ? colors.destructiveSurface : colors.surface, borderWidth: 1, borderColor: value === answer ? colors.destructive : colors.border }}>
            <Text style={{ color: value === answer ? colors.destructiveText : colors.secondaryText, fontWeight: '900', textTransform: 'capitalize' }}>{answer}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

type ChoiceProps<TValue extends string> = { label: string; value: TValue; options: ChoiceOption<TValue>[]; onChange: (value: TValue) => void; colors: AppThemeColors };
function Choice<TValue extends string>({ label, value, options, onChange, colors }: ChoiceProps<TValue>) {
  return (
    <View style={{ marginTop: 13 }}>
      <Text style={{ color: colors.secondaryText, fontWeight: '900' }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 7, paddingTop: 7 }}>
        {options.map((option) => (
          <TouchableOpacity key={option.value} onPress={() => onChange(option.value)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 99, backgroundColor: value === option.value ? colors.accent : colors.surface, borderWidth: 1, borderColor: value === option.value ? colors.accent : colors.border }}>
            <Text style={{ color: value === option.value ? '#fff' : colors.secondaryText, fontWeight: '800', textTransform: 'capitalize' }}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
