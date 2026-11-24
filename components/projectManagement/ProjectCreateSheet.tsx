import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Flag, ListChecks, X } from 'lucide-react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import DateTimeField from '@/components/ui/DateTimeField';
import ProjectColorPicker from '@/components/projectManagement/ProjectColorPicker';
import { projectColorHex } from '@/components/projectManagement/projectColors';
import { PROJECT_TEMPLATE_ICONS } from '@/components/projectManagement/projectTemplateIcons';
import { PROJECT_GUTTER, PROJECT_RIPPLE, ProjectButton, ProjectIconButton, ProjectScreenHeader } from '@/components/projectManagement/ProjectUiParts';
import { toCalendarString } from '@/components/projectManagement/projectFormat';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { projectInsightRules } from '@/lib/services/ProjectInsightRules';
import { projectTemplateService, type ProjectTemplate, type ProjectTemplateId } from '@/lib/services/ProjectTemplateService';

export type ProjectCreateValues = {
  templateId: ProjectTemplateId;
  name: string;
  description: string;
  color: string;
  dueDate: string | null;
  includeStarter: boolean;
};

type ProjectCreateSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Creates the project (and its starter content when chosen). Throw to keep the sheet open with the message shown. */
  onSubmit: (values: ProjectCreateValues, onProgress: (label: string) => void) => Promise<void>;
};

// Same limits as the website's create project form.
const NAME_LIMIT = 50;
const DESCRIPTION_LIMIT = 300;
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

function templateMeta(template: ProjectTemplate): string {
  if (!projectTemplateService.hasStarterContent(template)) return 'Starts empty';
  return [plural(template.tasks.length, 'starter task', 'starter tasks'), plural(template.milestones.length, 'milestone', 'milestones')].join(' · ');
}

/** New project: pick a template, then name it, say what it is for and choose whether to add the starter plan. */
export default function ProjectCreateSheet({ visible, onClose, onSubmit }: ProjectCreateSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'template' | 'details'>('template');
  const [templateId, setTemplateId] = useState<ProjectTemplateId>('blank');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('bg-emerald-500');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [includeStarter, setIncludeStarter] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setStep('template'); setTemplateId('blank'); setName(''); setDescription(''); setColor('bg-emerald-500');
    setDueDate(null); setIncludeStarter(true); setError(''); setProgress('');
  }, [visible]);

  const template = projectTemplateService.get(templateId);
  const today = projectInsightRules.today();
  const plan = useMemo(() => projectTemplateService.plan(template, today), [template, today]);
  const hasStarter = projectTemplateService.hasStarterContent(template);

  const handleChooseTemplate = (id: ProjectTemplateId): void => {
    const chosen = projectTemplateService.get(id);
    setTemplateId(id);
    setColor(chosen.color);
    setIncludeStarter(projectTemplateService.hasStarterContent(chosen));
    setError('');
    setStep('details');
  };

  const handleClose = (): void => {
    if (savingRef.current) return;
    if (step === 'details') { setStep('template'); return; }
    onClose();
  };

  const handleSubmit = async (): Promise<void> => {
    if (savingRef.current) return;
    if (!name.trim()) { setError('Give the project a name.'); return; }
    savingRef.current = true;
    setIsSaving(true);
    setError('');
    try {
      await onSubmit({
        templateId, name: name.trim(), description: description.trim(), color,
        dueDate: dueDate ? toCalendarString(dueDate) : null, includeStarter: hasStarter && includeStarter,
      }, setProgress);
    } catch (submitError: unknown) {
      console.error('[ProjectCreateSheet.handleSubmit] Error:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'The project could not be created. Try again.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
      setProgress('');
    }
  };

  const milestoneNames = new Map(plan.milestones.map((milestone) => [milestone.key, milestone.name]));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.root}>
        <ProjectScreenHeader
          title={step === 'template' ? 'New project' : template.name}
          subtitle={step === 'template' ? 'Step 1 of 2 · Choose a starting point' : 'Step 2 of 2 · Details'}
          onBack={handleClose}
          right={step === 'details' ? <ProjectIconButton accessibilityLabel="Close" onPress={() => { if (!savingRef.current) onClose(); }}><X size={22} color={colors.icon} /></ProjectIconButton> : undefined}
        />
        {step === 'template' ? (
          <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.lead}>A template fills in a starter plan you can change later. Nothing is shared until you invite people.</Text>
              {projectTemplateService.list().map((option) => {
                const Icon = PROJECT_TEMPLATE_ICONS[option.id];
                return (
                  <Pressable key={option.id} onPress={() => handleChooseTemplate(option.id)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={`${option.name}. ${option.summary} ${templateMeta(option)}`} style={styles.templateCard}>
                    <View style={[styles.templateIcon, { backgroundColor: projectColorHex(option.color) }]}><Icon size={22} color="#ffffff" /></View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text numberOfLines={1} style={styles.templateName}>{option.name}</Text>
                      <Text numberOfLines={2} style={styles.templateSummary}>{option.summary}</Text>
                      <Text numberOfLines={1} style={styles.templateMeta}>{templateMeta(option)}</Text>
                    </View>
                    <ChevronRight size={18} color={colors.mutedText} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        ) : (
          <KeyboardSafeView style={{ flex: 1 }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <View style={styles.field}>
                <View style={styles.labelRow}><Text style={styles.label}>Project name *</Text><Text style={styles.counter}>{name.length}/{NAME_LIMIT}</Text></View>
                <TextInput value={name} onChangeText={setName} maxLength={NAME_LIMIT} editable={!isSaving} placeholder={template.namePlaceholder} placeholderTextColor={colors.mutedText} accessibilityLabel="Project name" style={styles.input} />
              </View>
              <View style={styles.field}>
                <View style={styles.labelRow}><Text style={styles.label}>Purpose</Text><Text style={styles.counter}>{description.length}/{DESCRIPTION_LIMIT}</Text></View>
                <TextInput value={description} onChangeText={(value) => setDescription(value.slice(0, DESCRIPTION_LIMIT))} editable={!isSaving} multiline placeholder={template.purposePlaceholder} placeholderTextColor={colors.mutedText} accessibilityLabel="Purpose" style={[styles.input, styles.textArea]} />
                <Text style={styles.hint}>Shown at the top of the project so everyone knows what it is for.</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Colour</Text>
                <ProjectColorPicker value={color} onChange={setColor} disabled={isSaving} />
              </View>
              <DateTimeField label="Target date (optional)" mode="date" placeholder="No target date" value={dueDate} minimumDate={new Date()} onChange={setDueDate} onClear={() => setDueDate(null)} />

              {hasStarter ? (
                <View style={styles.starterCard}>
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.starterTitle}>Add the starter plan</Text>
                      <Text style={styles.hint}>{templateMeta(template)}, dated from today and assigned to you. Change or delete any of them later.</Text>
                    </View>
                    <Switch value={includeStarter} onValueChange={setIncludeStarter} disabled={isSaving} accessibilityLabel="Add the starter plan" trackColor={{ true: colors.accent, false: colors.border }} />
                  </View>
                  {includeStarter ? (
                    <View style={{ gap: 8 }}>
                      {plan.milestones.map((milestone) => (
                        <View key={milestone.key} style={styles.previewRow}>
                          <Flag size={15} color={colors.accentText} />
                          <Text numberOfLines={2} style={[styles.previewText, { fontWeight: '700' }]}>{milestone.name}</Text>
                          <Text style={styles.previewDate}>{projectInsightRules.shortDate(milestone.dueDate, today)}</Text>
                        </View>
                      ))}
                      {plan.tasks.map((task) => (
                        <View key={task.title} style={styles.previewRow}>
                          <ListChecks size={15} color={colors.mutedText} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text numberOfLines={2} style={styles.previewText}>{task.title}</Text>
                            {task.milestoneKey ? <Text numberOfLines={1} style={styles.previewSub}>{milestoneNames.get(task.milestoneKey)}</Text> : null}
                          </View>
                          <Text style={styles.previewDate}>{projectInsightRules.shortDate(task.dueDate, today)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
            <View style={[styles.bar, { paddingBottom: Math.max(12, insets.bottom) }]}>
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              {progress ? <Text accessibilityLiveRegion="polite" style={styles.progress}>{progress}</Text> : null}
              <ProjectButton label="Create project" busyLabel="Creating…" isBusy={isSaving} onPress={() => void handleSubmit()} />
            </View>
          </KeyboardSafeView>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: PROJECT_GUTTER, gap: 14, paddingBottom: 32 },
  lead: { color: colors.secondaryText, fontSize: 14, lineHeight: 20 },
  templateCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 76, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  templateIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  templateName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  templateSummary: { color: colors.secondaryText, fontSize: 13, lineHeight: 18 },
  templateMeta: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  label: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  counter: { color: colors.mutedText, fontSize: 12 },
  input: { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 },
  textArea: { minHeight: 96, paddingVertical: 12, textAlignVertical: 'top' },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  starterCard: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  starterTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  previewText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 19 },
  previewSub: { color: colors.mutedText, fontSize: 12 },
  previewDate: { color: colors.mutedText, fontSize: 12, fontWeight: '600', marginTop: 1 },
  bar: { paddingHorizontal: PROJECT_GUTTER, paddingTop: 12, gap: 8, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  error: { color: colors.destructiveText, fontSize: 13, fontWeight: '700' },
  progress: { color: colors.accentText, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
