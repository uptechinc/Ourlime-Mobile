import { useCallback, useEffect, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UserProfile } from '@/lib/services/AuthService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { Skeleton } from '@/components/ui/Skeleton';
import CustomModal from '@/components/ui/CustomModal';
import SocialLinksRow from '@/components/profile/SocialLinksRow';
import AboutEntryFormSheet, { type AboutEntryFormKind, type AboutEntryFormValues } from '@/components/profile/AboutEntryFormSheet';
import {
  CONTACT_TYPES,
  profileAboutService,
  type AboutValueEntry,
  type AboutValueKind,
  type ContactType,
  type EducationEntry,
  type ProfileAboutData,
  type WorkExperienceEntry,
} from '@/lib/services/ProfileAboutService';

type AboutTabProps = {
  profile: UserProfile;
  /** Own profile: every section is editable, like the website's About tab. */
  isOwnProfile?: boolean;
  /** Opens the profile editor for name / username / country (website Basic Information edit). */
  onEditBasicInfo?: () => void;
};

type IconName = ComponentProps<typeof Ionicons>['name'];
type FormState = { kind: AboutEntryFormKind; entryId: string | null; values: AboutEntryFormValues | null } | null;
type DeleteTarget = { kind: 'work' | 'education' | AboutValueKind; id: string; label: string } | { kind: 'contact'; id: string; label: string } | null;

const formatMonthYear = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const formatRange = (startDate: string, endDate: string | null, current: boolean): string => {
  const start = formatMonthYear(startDate);
  const end = current ? 'Present' : formatMonthYear(endDate);
  return [start, end].filter(Boolean).join(' – ');
};

export default function AboutTab({ profile, isOwnProfile = false, onEditBasicInfo }: AboutTabProps) {
  const { colors } = useAppTheme();
  const [about, setAbout] = useState<ProfileAboutData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async (): Promise<void> => {
    setLoadError('');
    try {
      setAbout(await profileAboutService.load(profile.uid, isOwnProfile));
    } catch (error: unknown) {
      console.error('[AboutTab.load] Error:', error);
      setLoadError('Profile details could not be loaded.');
    }
  }, [isOwnProfile, profile.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmitEntry = async (values: AboutEntryFormValues): Promise<void> => {
    if (!formState) return;
    const { kind, entryId } = formState;
    if (kind === 'work') {
      const input = { role: values.title, company: values.organization, startDate: values.startDate, endDate: values.endDate, current: values.current, description: values.description };
      const saved = entryId
        ? await profileAboutService.updateWorkExperience(profile.uid, entryId, input)
        : await profileAboutService.addWorkExperience(profile.uid, input);
      setAbout((current) => current ? { ...current, workExperience: upsert(current.workExperience, saved) } : current);
    } else {
      const input = { degree: values.title, school: values.organization, startDate: values.startDate, endDate: values.endDate, current: values.current, description: values.description };
      const saved = entryId
        ? await profileAboutService.updateEducation(profile.uid, entryId, input)
        : await profileAboutService.addEducation(profile.uid, input);
      setAbout((current) => current ? { ...current, education: upsert(current.education, saved) } : current);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'work') {
        await profileAboutService.deleteWorkExperience(profile.uid, deleteTarget.id);
        setAbout((current) => current ? { ...current, workExperience: current.workExperience.filter((entry) => entry.id !== deleteTarget.id) } : current);
      } else if (deleteTarget.kind === 'education') {
        await profileAboutService.deleteEducation(profile.uid, deleteTarget.id);
        setAbout((current) => current ? { ...current, education: current.education.filter((entry) => entry.id !== deleteTarget.id) } : current);
      } else if (deleteTarget.kind === 'contact') {
        const contacts = await profileAboutService.removeContact(profile.uid, deleteTarget.id);
        setAbout((current) => current ? { ...current, contacts } : current);
      } else {
        const kind = deleteTarget.kind;
        await profileAboutService.deleteAboutValue(profile.uid, deleteTarget.id);
        setAbout((current) => current ? { ...current, [kind]: current[kind].filter((entry) => entry.id !== deleteTarget.id) } : current);
      }
      setDeleteTarget(null);
    } catch (error: unknown) {
      console.error('[AboutTab.handleConfirmDelete] Error:', error);
      setDeleteTarget(null);
      setActionError('That item could not be removed. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!about) {
    if (loadError) {
      return (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: colors.destructiveText, textAlign: 'center' }}>{loadError}</Text>
          <TouchableOpacity onPress={() => void load()} style={{ marginTop: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.accent }}>
            <Text style={{ color: colors.onAccent, fontWeight: '800' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <AboutTabSkeleton />;
  }

  const displayName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || profile.userName;
  const basicRows: { label: string; value: string }[] = [
    { label: 'Full Name', value: displayName },
    { label: 'Username', value: profile.userName ? `@${profile.userName}` : '' },
    { label: 'Gender', value: about.gender || profile.gender || '' },
    { label: 'Birthday', value: isOwnProfile ? profile.dateOfBirth ?? '' : '' },
    { label: 'Country', value: about.country || profile.country || '' },
    { label: 'Joined', value: about.joinedAtMs ? new Date(about.joinedAtMs).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '' },
  ].filter((row) => row.value);

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {actionError ? (
        <TouchableOpacity onPress={() => setActionError('')} style={{ padding: 12, borderRadius: 14, backgroundColor: colors.destructiveSurface }}>
          <Text style={{ color: colors.destructiveText, fontWeight: '700', textAlign: 'center' }}>{actionError}</Text>
        </TouchableOpacity>
      ) : null}

      {isOwnProfile || profile.email ? (
        <SectionCard icon="call-outline" title="Contact Information">
          {profile.email ? <InfoRow icon="mail-outline" text={profile.email} /> : null}
          {isOwnProfile ? (
            <ContactEditor
              userId={profile.uid}
              contacts={about.contacts}
              onContactsChange={(contacts) => setAbout((current) => current ? { ...current, contacts } : current)}
              onRemove={(number) => setDeleteTarget({ kind: 'contact', id: number, label: number })}
            />
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        icon="person-outline"
        title="Basic Information"
        action={isOwnProfile && onEditBasicInfo ? { label: 'Edit', onPress: onEditBasicInfo } : undefined}
      >
        {basicRows.map((row) => (
          <View key={row.label} style={{ paddingVertical: 4 }}>
            <Text style={{ color: colors.mutedText, fontSize: 12, fontWeight: '600' }}>{row.label}</Text>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 1 }}>{row.value}</Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard
        icon="briefcase-outline"
        title="Work Experience"
        action={isOwnProfile ? { label: 'Add', onPress: () => setFormState({ kind: 'work', entryId: null, values: null }) } : undefined}
      >
        {about.workExperience.length === 0 ? (
          <EmptyLine text={isOwnProfile ? 'No work experience added yet. Add your work experience to showcase your professional background.' : 'No work experience shared.'} />
        ) : about.workExperience.map((entry) => (
          <EntryRow
            key={entry.id}
            icon="briefcase"
            title={entry.role}
            subtitle={entry.company}
            range={formatRange(entry.startDate, entry.endDate, entry.current)}
            description={entry.description}
            onEdit={isOwnProfile ? () => setFormState({ kind: 'work', entryId: entry.id, values: workToForm(entry) }) : undefined}
            onDelete={isOwnProfile ? () => setDeleteTarget({ kind: 'work', id: entry.id, label: entry.role }) : undefined}
          />
        ))}
      </SectionCard>

      <SectionCard
        icon="school-outline"
        title="Education"
        action={isOwnProfile ? { label: 'Add', onPress: () => setFormState({ kind: 'education', entryId: null, values: null }) } : undefined}
      >
        {about.education.length === 0 ? (
          <EmptyLine text={isOwnProfile ? 'No education added yet. Add your schools and qualifications.' : 'No education shared.'} />
        ) : about.education.map((entry) => (
          <EntryRow
            key={entry.id}
            icon="school"
            title={entry.degree}
            subtitle={entry.school}
            range={formatRange(entry.startDate, entry.endDate, entry.current)}
            description={entry.description}
            onEdit={isOwnProfile ? () => setFormState({ kind: 'education', entryId: entry.id, values: educationToForm(entry) }) : undefined}
            onDelete={isOwnProfile ? () => setDeleteTarget({ kind: 'education', id: entry.id, label: entry.degree }) : undefined}
          />
        ))}
      </SectionCard>

      {(['interests', 'skills'] as const).map((kind) => (
        <SectionCard key={kind} icon={kind === 'interests' ? 'heart-outline' : 'code-slash-outline'} title={kind === 'interests' ? 'Interests' : 'Skills'}>
          <ValueChips
            userId={profile.uid}
            kind={kind}
            entries={about[kind]}
            editable={isOwnProfile}
            onEntriesChange={(entries) => setAbout((current) => current ? { ...current, [kind]: entries } : current)}
            onDelete={(entry) => setDeleteTarget({ kind, id: entry.id, label: entry.value })}
          />
        </SectionCard>
      ))}

      <SectionCard icon="globe-outline" title="Social Links">
        {profileAboutService.toSocialLinkItems(about.socialLinks).length > 0 ? (
          <SocialLinksRow socialLinks={about.socialLinks} />
        ) : (
          <EmptyLine text={isOwnProfile ? 'No social links yet. You can add them from your profile on ourlime.com.' : 'No social links shared.'} />
        )}
      </SectionCard>

      <AboutEntryFormSheet
        visible={formState !== null}
        kind={formState?.kind ?? 'work'}
        initialValues={formState?.values ?? null}
        onClose={() => setFormState(null)}
        onSubmit={handleSubmitEntry}
      />
      <CustomModal
        visible={deleteTarget !== null}
        type="danger"
        title="Remove this item?"
        message={deleteTarget ? `"${deleteTarget.label}" will be removed from your profile.` : ''}
        confirmText="Remove"
        cancelText="Cancel"
        isLoading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </View>
  );
}

function upsert<T extends { id: string }>(entries: T[], saved: T): T[] {
  return entries.some((entry) => entry.id === saved.id)
    ? entries.map((entry) => (entry.id === saved.id ? saved : entry))
    : [saved, ...entries];
}

function workToForm(entry: WorkExperienceEntry): AboutEntryFormValues {
  return { title: entry.role, organization: entry.company, startDate: entry.startDate, endDate: entry.endDate, current: entry.current, description: entry.description };
}

function educationToForm(entry: EducationEntry): AboutEntryFormValues {
  return { title: entry.degree, organization: entry.school, startDate: entry.startDate, endDate: entry.endDate, current: entry.current, description: entry.description };
}

type SectionCardProps = { icon: IconName; title: string; action?: { label: string; onPress: () => void }; children: ReactNode };
function SectionCard({ icon, title, action, children }: SectionCardProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={18} color={colors.accent} />
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.text }}>{title}</Text>
        {action ? (
          <TouchableOpacity onPress={action.onPress} accessibilityRole="button" accessibilityLabel={`${action.label} ${title}`} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.successSurface }}>
            <Text style={{ color: colors.successText, fontWeight: '800', fontSize: 12 }}>{action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function InfoRow({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name={icon} size={17} color={colors.accentText} />
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{text}</Text>
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  const { colors } = useAppTheme();
  return <Text style={{ color: colors.mutedText, fontSize: 13, lineHeight: 19 }}>{text}</Text>;
}

type EntryRowProps = { icon: IconName; title: string; subtitle: string; range: string; description: string; onEdit?: () => void; onDelete?: () => void };
function EntryRow({ icon, title, subtitle, range, description, onEdit, onDelete }: EntryRowProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 6 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.successSurface, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={colors.accentText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{title}</Text>
        <Text style={{ color: colors.secondaryText, marginTop: 1 }}>{subtitle}</Text>
        {range ? <Text style={{ color: colors.mutedText, fontSize: 12, marginTop: 2 }}>{range}</Text> : null}
        {description ? <Text style={{ color: colors.secondaryText, fontSize: 13, marginTop: 6, lineHeight: 19 }}>{description}</Text> : null}
      </View>
      {onEdit || onDelete ? (
        <View style={{ gap: 6 }}>
          {onEdit ? <TouchableOpacity onPress={onEdit} accessibilityLabel={`Edit ${title}`} style={{ padding: 6 }}><Ionicons name="create-outline" size={18} color={colors.icon} /></TouchableOpacity> : null}
          {onDelete ? <TouchableOpacity onPress={onDelete} accessibilityLabel={`Delete ${title}`} style={{ padding: 6 }}><Ionicons name="trash-outline" size={18} color={colors.destructive} /></TouchableOpacity> : null}
        </View>
      ) : null}
    </View>
  );
}

type ValueChipsProps = {
  userId: string;
  kind: AboutValueKind;
  entries: AboutValueEntry[];
  editable: boolean;
  onEntriesChange: (entries: AboutValueEntry[]) => void;
  onDelete: (entry: AboutValueEntry) => void;
};
function ValueChips({ userId, kind, entries, editable, onEntriesChange, onDelete }: ValueChipsProps) {
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const noun = kind === 'interests' ? 'interest' : 'skill';

  const handleAdd = async (): Promise<void> => {
    if (saving || !draft.trim()) return;
    setSaving(true);
    setError('');
    try {
      const entry = await profileAboutService.addAboutValue(userId, kind, draft);
      onEntriesChange([...entries, entry]);
      setDraft('');
    } catch (addError: unknown) {
      console.error('[ValueChips.handleAdd] Error:', addError);
      setError(addError instanceof Error ? addError.message : `Failed to add ${noun}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (): Promise<void> => {
    if (saving || !editingId) return;
    setSaving(true);
    setError('');
    try {
      const entry = await profileAboutService.updateAboutValue(userId, kind, editingId, editingValue);
      onEntriesChange(entries.map((item) => (item.id === entry.id ? entry : item)));
      setEditingId(null);
    } catch (editError: unknown) {
      console.error('[ValueChips.handleSaveEdit] Error:', editError);
      setError(editError instanceof Error ? editError.message : `Failed to update ${noun}`);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, color: colors.text, paddingHorizontal: 12, paddingVertical: 9 } as const;

  return (
    <View style={{ gap: 10 }}>
      {entries.length === 0 ? <EmptyLine text={editable ? `No ${kind} added yet.` : `No ${kind} shared.`} /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {entries.map((entry) => editingId === entry.id ? (
            <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' }}>
              <TextInput value={editingValue} onChangeText={setEditingValue} autoFocus accessibilityLabel={`Edit ${noun}`} style={inputStyle} />
              <TouchableOpacity onPress={() => void handleSaveEdit()} accessibilityLabel={`Save ${noun}`} style={{ padding: 8, borderRadius: 10, backgroundColor: colors.accent }}>
                {saving ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Ionicons name="checkmark" size={16} color={colors.onAccent} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingId(null)} accessibilityLabel="Cancel" style={{ padding: 8, borderRadius: 10, backgroundColor: colors.control }}>
                <Ionicons name="close" size={16} color={colors.icon} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              key={entry.id}
              disabled={!editable}
              onPress={() => { setEditingId(entry.id); setEditingValue(entry.value); }}
              onLongPress={editable ? () => onDelete(entry) : undefined}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: editable ? 6 : 12, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.successSurface }}
            >
              <Text style={{ color: colors.successText, fontWeight: '700', fontSize: 13 }}>{entry.value}</Text>
              {editable ? (
                <TouchableOpacity onPress={() => onDelete(entry)} hitSlop={8} accessibilityLabel={`Remove ${entry.value}`}>
                  <Ionicons name="close-circle" size={16} color={colors.successText} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}
      {editable ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput value={draft} onChangeText={setDraft} placeholder={`Add a new ${noun}`} placeholderTextColor={colors.mutedText} onSubmitEditing={() => void handleAdd()} returnKeyType="done" accessibilityLabel={`New ${noun}`} style={inputStyle} />
          <TouchableOpacity onPress={() => void handleAdd()} disabled={saving || !draft.trim()} accessibilityLabel={`Add ${noun}`} style={{ padding: 10, borderRadius: 12, backgroundColor: colors.accent, opacity: saving || !draft.trim() ? 0.5 : 1 }}>
            {saving && !editingId ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Ionicons name="add" size={18} color={colors.onAccent} />}
          </TouchableOpacity>
        </View>
      ) : null}
      {error ? <Text style={{ color: colors.destructiveText, fontSize: 12, fontWeight: '700' }}>{error}</Text> : null}
    </View>
  );
}

type ContactEditorProps = {
  userId: string;
  contacts: ProfileAboutData['contacts'];
  onContactsChange: (contacts: ProfileAboutData['contacts']) => void;
  onRemove: (number: string) => void;
};
function ContactEditor({ userId, contacts, onContactsChange, onRemove }: ContactEditorProps) {
  const { colors } = useAppTheme();
  const [adding, setAdding] = useState(false);
  const [number, setNumber] = useState('');
  const [type, setType] = useState<ContactType>('personal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      onContactsChange(await profileAboutService.addContact(userId, number, type));
      setAdding(false);
      setNumber('');
      setType('personal');
    } catch (addError: unknown) {
      console.error('[ContactEditor.handleAdd] Error:', addError);
      setError(addError instanceof Error ? addError.message : 'Failed to add contact. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {contacts.map((contact) => (
        <View key={contact.number} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="call-outline" size={17} color={colors.accentText} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{contact.number}</Text>
            <Text style={{ color: colors.mutedText, fontSize: 12, textTransform: 'capitalize' }}>{contact.type}{contact.isVerified ? ' · Verified' : ' · Not verified'}</Text>
          </View>
          <TouchableOpacity onPress={() => onRemove(contact.number)} accessibilityLabel={`Remove ${contact.number}`} style={{ padding: 6 }}>
            <Ionicons name="trash-outline" size={18} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      ))}
      {adding ? (
        <View style={{ gap: 8 }}>
          <TextInput value={number} onChangeText={setNumber} keyboardType="phone-pad" placeholder="+1 868 555 1234" placeholderTextColor={colors.mutedText} accessibilityLabel="Phone number" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, color: colors.text, paddingHorizontal: 12, paddingVertical: 10 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CONTACT_TYPES.map((option) => (
              <TouchableOpacity key={option.value} onPress={() => setType(option.value)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: type === option.value ? colors.selectedControl : colors.control }}>
                <Text style={{ color: type === option.value ? colors.selectedText : colors.secondaryText, fontWeight: '700', fontSize: 12 }}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {error ? <Text style={{ color: colors.destructiveText, fontSize: 12, fontWeight: '700' }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => { setAdding(false); setError(''); }} disabled={saving} style={{ flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void handleAdd()} disabled={saving || !number.trim()} style={{ flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: saving || !number.trim() ? 0.6 : 1 }}>
              {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '800' }}>Save Number</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setAdding(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 }}>
          <Ionicons name="add-circle-outline" size={18} color={colors.accentText} />
          <Text style={{ color: colors.accentText, fontWeight: '800' }}>Add phone number</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Mirrors the About tab: stacked section cards with a heading and a few rows each. */
function AboutTabSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={{ padding: 16, gap: 12 }} accessibilityLabel="Loading profile details">
      {[3, 2, 2, 1].map((rows, index) => (
        <View key={`about-skeleton-${index}`} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Skeleton width={18} height={18} borderRadius={6} />
            <Skeleton width="45%" height={16} />
          </View>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <View key={`about-skeleton-${index}-${rowIndex}`} style={{ flexDirection: 'row', gap: 12 }}>
              <Skeleton width={40} height={40} borderRadius={12} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
