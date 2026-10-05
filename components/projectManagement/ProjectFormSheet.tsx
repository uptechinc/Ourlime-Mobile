import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Globe, Lock, Plus, X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import DateTimeField from '@/components/ui/DateTimeField';
import type { ProjectRecord, ProjectStatus, ProjectVisibility } from '@/lib/types/project';

export type ProjectFormValues = {
  name: string;
  description: string;
  dueDate: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  tags: string[];
};

type ProjectFormSheetProps = {
  visible: boolean;
  /** Edit this project; null creates a new one. */
  project: ProjectRecord | null;
  onClose: () => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
};

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];
// Same limits as the website's CreateProjectModal.
const NAME_LIMIT = 50;
const DESCRIPTION_LIMIT = 300;
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 25;

/** Local calendar date as 'YYYY-MM-DD' (what the website's project form saves). */
function toDateString(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateString(value: string | null): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

/** Create / edit project form with the same fields as the website's project modal. */
export default function ProjectFormSheet({ visible, project, onClose, onSubmit }: ProjectFormSheetProps) {
  const { colors } = useAppTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [visibility, setVisibility] = useState<ProjectVisibility>('private');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setName(project?.name ?? '');
    setDescription(project?.description ?? '');
    setDueDate(parseDateString(project?.dueDate ?? null));
    setStatus(project?.status ?? 'active');
    setVisibility(project?.visibility ?? 'private');
    setTags(project?.tags ?? []);
    setTagInput('');
    setError('');
  }, [project, visible]);

  const handleAddTag = (): void => {
    const tag = tagInput.trim().replace(/^#/, '');
    if (!tag) return;
    if (tag.length > MAX_TAG_LENGTH) { setError(`Tags must be ${MAX_TAG_LENGTH} characters or fewer.`); return; }
    if (tags.length >= MAX_TAGS) { setError(`Up to ${MAX_TAGS} tags.`); return; }
    if (!tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) setTags((current) => [...current, tag]);
    setTagInput('');
  };

  const handleSubmit = async (): Promise<void> => {
    if (savingRef.current) return;
    if (!name.trim()) { setError('Project name is required.'); return; }
    savingRef.current = true;
    setIsSaving(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), dueDate: dueDate ? toDateString(dueDate) : null, status, visibility, tags });
    } catch (submitError: unknown) {
      console.error('[ProjectFormSheet.handleSubmit] Error:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'The project could not be saved.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const chip = (selected: boolean) => ({
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.control,
  });
  const label = { color: colors.mutedText, fontSize: 11, fontWeight: '800' as const };
  const input = { minHeight: 46, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { if (!savingRef.current) onClose(); }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={onClose} disabled={isSaving} accessibilityLabel="Close" style={{ padding: 6 }}><X size={22} color={colors.text} /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '900' }}>{project ? 'Edit project' : 'New project'}</Text>
          <TouchableOpacity onPress={() => void handleSubmit()} disabled={isSaving} style={{ minWidth: 72, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.accent, opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900' }}>{project ? 'Save' : 'Create'}</Text>}
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}>
            {error ? <Text accessibilityRole="alert" style={{ color: colors.destructiveText, fontWeight: '700' }}>{error}</Text> : null}
            <View style={{ gap: 6 }}>
              <Text style={label}>Project Name <Text style={{ color: '#ef4444' }}>*</Text></Text>
              <TextInput value={name} onChangeText={setName} maxLength={NAME_LIMIT} editable={!isSaving} placeholder="Enter project name" placeholderTextColor={colors.mutedText} style={input} />
            </View>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={label}>Description</Text>
                <Text style={label}>{description.length}/{DESCRIPTION_LIMIT}</Text>
              </View>
              <TextInput value={description} onChangeText={(value) => setDescription(value.slice(0, DESCRIPTION_LIMIT))} editable={!isSaving} multiline placeholder="Enter project description" placeholderTextColor={colors.mutedText} style={[input, { minHeight: 96, paddingVertical: 12, textAlignVertical: 'top' }]} />
            </View>
            <DateTimeField label="Due Date" mode="date" placeholder="No due date" value={dueDate} minimumDate={project ? undefined : new Date()} onChange={setDueDate} onClear={() => setDueDate(null)} />
            <View style={{ gap: 8 }}>
              <Text style={label}>Project Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {STATUS_OPTIONS.map((option) => (
                  <TouchableOpacity key={option.value} onPress={() => setStatus(option.value)} style={chip(status === option.value)}>
                    <Text style={{ color: status === option.value ? colors.onAccent : colors.secondaryText, fontWeight: '800', fontSize: 12 }}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={label}>Visibility</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['private', 'public'] as const).map((option) => {
                  const selected = visibility === option;
                  const Icon = option === 'private' ? Lock : Globe;
                  return (
                    <TouchableOpacity key={option} onPress={() => setVisibility(option)} style={chip(selected)}>
                      <Icon size={14} color={selected ? colors.onAccent : colors.secondaryText} />
                      <Text style={{ color: selected ? colors.onAccent : colors.secondaryText, fontWeight: '800', fontSize: 12, textTransform: 'capitalize' }}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={label}>Tags</Text>
                <Text style={label}>{tags.length}/{MAX_TAGS}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={tagInput} onChangeText={setTagInput} onSubmitEditing={handleAddTag} editable={!isSaving} placeholder="Add a tag" placeholderTextColor={colors.mutedText} style={[input, { flex: 1 }]} />
                <TouchableOpacity onPress={handleAddTag} accessibilityLabel="Add tag" style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}><Plus size={18} color={colors.onAccent} /></TouchableOpacity>
              </View>
              {tags.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {tags.map((tag) => (
                    <TouchableOpacity key={tag} onPress={() => setTags((current) => current.filter((existing) => existing !== tag))} accessibilityLabel={`Remove tag ${tag}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.successSurface }}>
                      <Text style={{ color: colors.successText, fontWeight: '800', fontSize: 12 }}>#{tag}</Text>
                      <X size={12} color={colors.successText} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
