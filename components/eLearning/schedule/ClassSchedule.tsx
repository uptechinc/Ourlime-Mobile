import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CalendarDays, Check, Copy, Download, LayoutList, Mail, MessageCircle, Plus, Repeat, Trash2 } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import { Skeleton } from '@/components/ui/Skeleton';
import ScheduleSheet from './ScheduleSheet';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useClassSchedule } from '@/lib/hooks/useClassSchedule';
import {
  CLASS_COLORS,
  SCHEDULE_DAYS,
  SCHEDULE_END_SLOTS,
  SCHEDULE_FIRST_HOUR,
  SCHEDULE_START_SLOTS,
  ScheduleEditingUnavailableError,
  scheduleService,
} from '@/lib/services/ScheduleService';
import type { ClassSchedule as ClassScheduleItem, ClassScheduleForm } from '@/lib/types/schedule';

type ClassScheduleProps = { userId: string | null };
type Styles = ReturnType<typeof createStyles>;
type FormMode = { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; schedule: ClassScheduleItem };
type Notice = { visible: boolean; title: string; message: string };

const HOUR_ROW = 56;
const TIME_COLUMN = 52;
const DAY_COLUMN = 116;
const GREEN = '#10b981';

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof ScheduleEditingUnavailableError ? error.message : fallback;

/** Web components/eLearning/schedules: the learner's Monday–Friday class timetable with templates, export and reminders. */
export default function ClassSchedule({ userId }: ClassScheduleProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { schedules, templates, loading, error, refresh, addClass, updateClass, deleteClass, saveTemplate } = useClassSchedule(userId);
  const [formMode, setFormMode] = useState<FormMode>({ kind: 'closed' });
  const [form, setForm] = useState<ClassScheduleForm>(() => scheduleService.emptyForm());
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ClassScheduleItem | null>(null);
  const [notice, setNotice] = useState<Notice>({ visible: false, title: '', message: '' });

  const visibleSchedules = useMemo(() => scheduleService.visibleSchedules(schedules), [schedules]);
  const todayName = scheduleService.todayName();

  const showNotice = (title: string, message: string) => setNotice({ visible: true, title, message });

  const openAddForm = () => {
    setForm(scheduleService.emptyForm());
    setValidationMessage(null);
    setFormMode({ kind: 'add' });
  };

  const openEditForm = (schedule: ClassScheduleItem) => {
    setForm({
      subject: schedule.subject, startTime: schedule.startTime, endTime: schedule.endTime, day: schedule.day, color: schedule.color,
      isRecurring: schedule.isRecurring, recurringType: schedule.recurringType || 'weekly', reminders: schedule.reminders ?? { email: true, whatsapp: false },
    });
    setValidationMessage(null);
    setFormMode({ kind: 'edit', schedule });
  };

  const closeForm = () => {
    setFormMode({ kind: 'closed' });
    setValidationMessage(null);
  };

  const handleSubmitForm = async () => {
    if (!form.subject.trim()) { setValidationMessage('Enter a subject for this class.'); return; }
    const ignoreId = formMode.kind === 'edit' ? formMode.schedule.id : undefined;
    if (scheduleService.hasConflict(schedules, form, ignoreId)) { setValidationMessage('This time overlaps another class. Choose a different time.'); return; }
    setValidationMessage(null);
    setSaving(true);
    try {
      const next = { ...form, subject: form.subject.trim() };
      if (formMode.kind === 'edit') await updateClass(formMode.schedule.id, next);
      else await addClass(next);
      closeForm();
    } catch (saveError: unknown) {
      console.error('[ClassSchedule.handleSubmitForm] Error:', saveError instanceof Error ? saveError.message : 'Unknown error');
      setValidationMessage(errorMessage(saveError, 'Your class could not be saved. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteClass(deleteTarget.id);
      setSelectedIds((current) => current.filter((id) => id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteError: unknown) {
      console.error('[ClassSchedule.handleDelete] Error:', deleteError instanceof Error ? deleteError.message : 'Unknown error');
      setDeleteTarget(null);
      showNotice('Class not deleted', errorMessage(deleteError, 'This class could not be deleted. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name || selectedIds.length === 0) return;
    const entries = selectedIds
      .map((id) => schedules.find((schedule) => schedule.id === id))
      .filter((schedule): schedule is ClassScheduleItem => Boolean(schedule))
      .map(({ id: _id, status: _status, ...rest }) => rest);
    setSaving(true);
    try {
      await saveTemplate({ name, schedules: entries });
      setTemplateName('');
      setSelectedIds([]);
      setShowSaveTemplate(false);
    } catch (templateError: unknown) {
      console.error('[ClassSchedule.handleSaveTemplate] Error:', templateError instanceof Error ? templateError.message : 'Unknown error');
      setShowSaveTemplate(false);
      showNotice('Template not saved', errorMessage(templateError, 'This template could not be saved. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      await scheduleService.exportCalendar(schedules);
    } catch (exportError: unknown) {
      console.error('[ClassSchedule.handleExport] Error:', exportError instanceof Error ? exportError.message : 'Unknown error');
      showNotice('Export failed', 'Your schedule could not be exported on this device.');
    }
  };

  const toggleSelected = (scheduleId: string) => {
    setSelectedIds((current) => (current.includes(scheduleId) ? current.filter((id) => id !== scheduleId) : [...current, scheduleId]));
  };

  if (!userId) {
    return <Text style={styles.muted}>Sign in to plan your weekly classes.</Text>;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>Class schedule</Text>
        <Text style={styles.muted}>{loading ? 'Loading your week…' : `Your weekly timetable · ${visibleSchedules.length} ${visibleSchedules.length === 1 ? 'class' : 'classes'}`}</Text>
      </View>
      <View style={styles.actions}>
        {selectedIds.length > 0 ? (
          <ActionButton label={`Save ${selectedIds.length} as template`} icon={<Copy size={15} color={colors.text} />} onPress={() => setShowSaveTemplate(true)} styles={styles} />
        ) : null}
        <ActionButton label="Templates" icon={<LayoutList size={15} color={colors.text} />} onPress={() => setShowTemplates(true)} styles={styles} />
        <ActionButton label="Export" icon={<Download size={15} color={schedules.length ? colors.text : colors.disabledText} />} disabled={schedules.length === 0} onPress={() => void handleExport()} styles={styles} />
        <ActionButton label="Add class" icon={<Plus size={15} color="#ffffff" />} primary onPress={openAddForm} styles={styles} />
      </View>

      {loading ? <TimetableSkeleton styles={styles} /> : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void refresh()} style={styles.retryButton}><Text style={styles.primaryText}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <>
          {visibleSchedules.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}><CalendarDays size={24} color={GREEN} /></View>
              <Text style={styles.emptyTitle}>Your week is empty</Text>
              <Text style={[styles.muted, styles.center]}>Add your classes to see your week at a glance and get reminders before each one.</Text>
              <TouchableOpacity accessibilityRole="button" onPress={openAddForm} style={[styles.retryButton, styles.inlineButton]}>
                <Plus size={16} color="#ffffff" />
                <Text style={styles.primaryText}>Add your first class</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridFrame}>
            <View>
              <View style={styles.dayHeaderRow}>
                <View style={{ width: TIME_COLUMN }} />
                {SCHEDULE_DAYS.map((day) => (
                  <View key={day} style={styles.dayHeader}>
                    <Text style={styles.dayHeaderText}>{day.slice(0, 3)}</Text>
                    {day === todayName ? <Text style={styles.todayBadge}>TODAY</Text> : null}
                  </View>
                ))}
              </View>
              <View style={styles.gridBody}>
                <View style={{ width: TIME_COLUMN }}>
                  {SCHEDULE_START_SLOTS.map((time) => (
                    <Text key={time} style={styles.hourLabel}>{scheduleService.formatHour(time)}</Text>
                  ))}
                </View>
                {SCHEDULE_DAYS.map((day) => (
                  <View key={day} style={[styles.dayColumn, day === todayName && styles.todayColumn]}>
                    {SCHEDULE_START_SLOTS.map((time, index) => <View key={time} style={[styles.hourCell, index === 0 && styles.firstHourCell]} />)}
                    {visibleSchedules.filter((schedule) => schedule.day === day).map((schedule) => {
                      const start = scheduleService.parseHour(schedule.startTime);
                      const end = Math.max(scheduleService.parseHour(schedule.endTime), start + 1);
                      const isSelected = selectedIds.includes(schedule.id);
                      return (
                        <View
                          key={schedule.id}
                          style={[styles.block, {
                            top: (start - SCHEDULE_FIRST_HOUR) * HOUR_ROW + 2,
                            height: (end - start) * HOUR_ROW - 4,
                            backgroundColor: scheduleService.tint(schedule.color, 0.16),
                            borderLeftColor: schedule.color,
                          }]}
                        >
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${schedule.subject}, ${schedule.day} ${scheduleService.formatHour(schedule.startTime)} to ${scheduleService.formatHour(schedule.endTime)}`}
                            onPress={() => openEditForm(schedule)}
                            style={styles.blockButton}
                          >
                            <Text numberOfLines={2} style={styles.blockTitle}>{schedule.subject}</Text>
                            <Text style={styles.blockTime}>{scheduleService.formatHour(schedule.startTime)} – {scheduleService.formatHour(schedule.endTime)}</Text>
                            {schedule.isRecurring && end - start > 1 ? (
                              <View style={styles.repeatRow}>
                                <Repeat size={11} color={colors.secondaryText} />
                                <Text style={styles.blockTime}>{schedule.recurringType === 'monthly' ? 'Monthly' : 'Weekly'}</Text>
                              </View>
                            ) : null}
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isSelected }}
                            accessibilityLabel={isSelected ? `Unselect ${schedule.subject}` : `Select ${schedule.subject} for a template`}
                            onPress={() => toggleSelected(schedule.id)}
                            hitSlop={8}
                            style={[styles.selectToggle, isSelected && styles.selectToggleActive]}
                          >
                            {isSelected ? <Check size={11} color="#ffffff" strokeWidth={3} /> : null}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </>
      )}

      <ScheduleSheet
        visible={formMode.kind !== 'closed'}
        title={formMode.kind === 'edit' ? 'Edit class' : 'Add a class'}
        description={formMode.kind === 'add' ? 'It appears on your weekly timetable.' : undefined}
        onClose={closeForm}
        footer={(
          <>
            {formMode.kind === 'edit' ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => { const target = formMode.schedule; closeForm(); setDeleteTarget(target); }} style={[styles.footerButton, styles.deleteButton]}>
                <Trash2 size={16} color={colors.destructiveText} />
                <Text style={[styles.secondaryText, { color: colors.destructiveText }]}>Delete</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity accessibilityRole="button" onPress={closeForm} style={[styles.footerButton, styles.secondaryButton]}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => void handleSubmitForm()} style={[styles.footerButton, styles.primaryButton, saving && styles.disabled]}>
              <Text style={styles.primaryText}>{saving ? 'Saving…' : formMode.kind === 'edit' ? 'Save changes' : 'Add class'}</Text>
            </TouchableOpacity>
          </>
        )}
      >
        <ClassFormFields form={form} onChange={setForm} validationMessage={validationMessage} styles={styles} colors={colors} />
      </ScheduleSheet>

      <ScheduleSheet
        visible={showSaveTemplate}
        title="Save as template"
        description="Reuse these classes later, for example next term."
        onClose={() => setShowSaveTemplate(false)}
        footer={(
          <>
            <TouchableOpacity accessibilityRole="button" onPress={() => { setShowSaveTemplate(false); setSelectedIds([]); }} style={[styles.footerButton, styles.secondaryButton]}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={saving || selectedIds.length === 0 || !templateName.trim()}
              onPress={() => void handleSaveTemplate()}
              style={[styles.footerButton, styles.primaryButton, (saving || selectedIds.length === 0 || !templateName.trim()) && styles.disabled]}
            >
              <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save template'}</Text>
            </TouchableOpacity>
          </>
        )}
      >
        <View style={styles.field}>
          <Text style={styles.label}>Template name *</Text>
          <TextInput value={templateName} onChangeText={setTemplateName} placeholder="e.g. Term 1 timetable" placeholderTextColor={colors.mutedText} style={styles.input} />
        </View>
        <View style={styles.templateList}>
          {selectedIds.map((id) => schedules.find((schedule) => schedule.id === id)).filter((schedule): schedule is ClassScheduleItem => Boolean(schedule)).map((schedule) => (
            <View key={schedule.id} style={styles.templateRow}>
              <View style={[styles.dot, { backgroundColor: schedule.color }]} />
              <Text numberOfLines={1} style={[styles.templateSubject, styles.flex]}>{schedule.subject}</Text>
              <Text style={styles.small}>{schedule.day.slice(0, 3)} {scheduleService.formatHour(schedule.startTime)}</Text>
            </View>
          ))}
        </View>
      </ScheduleSheet>

      <ScheduleSheet
        visible={showTemplates}
        title="Saved templates"
        onClose={() => setShowTemplates(false)}
        footer={<TouchableOpacity accessibilityRole="button" onPress={() => setShowTemplates(false)} style={[styles.footerButton, styles.secondaryButton]}><Text style={styles.secondaryText}>Close</Text></TouchableOpacity>}
      >
        {templates.length === 0 ? (
          <View style={styles.emptyTemplates}>
            <LayoutList size={30} color={colors.mutedText} />
            <Text style={styles.templateSubject}>No templates yet</Text>
            <Text style={[styles.muted, styles.center]}>Tick classes on your timetable, then choose “Save as template”.</Text>
          </View>
        ) : templates.map((template, index) => (
          <View key={`${template.name}-${index}`} style={styles.templateCard}>
            <Text style={styles.templateName}>{template.name}</Text>
            {template.schedules.map((schedule, scheduleIndex) => (
              <View key={`${schedule.subject}-${scheduleIndex}`} style={styles.templateRow}>
                <View style={[styles.dot, { backgroundColor: schedule.color }]} />
                <Text numberOfLines={1} style={[styles.secondaryText, styles.flex]}>{schedule.subject}</Text>
                <Text style={styles.small}>{schedule.day.slice(0, 3)} {scheduleService.formatHour(schedule.startTime)}–{scheduleService.formatHour(schedule.endTime)}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScheduleSheet>

      <CustomModal
        visible={deleteTarget !== null}
        type="danger"
        title="Delete this class?"
        message={deleteTarget ? `${deleteTarget.subject} on ${deleteTarget.day} at ${scheduleService.formatHour(deleteTarget.startTime)} will be removed from your timetable. This can't be undone.` : ''}
        confirmText="Delete class"
        cancelText="Cancel"
        isLoading={saving}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onClose={() => setDeleteTarget(null)}
      />
      <CustomModal visible={notice.visible} type="error" title={notice.title} message={notice.message} onClose={() => setNotice((current) => ({ ...current, visible: false }))} />
    </View>
  );
}

type ActionButtonProps = { label: string; icon: ReactNode; onPress: () => void; primary?: boolean; disabled?: boolean; styles: Styles };
function ActionButton({ label, icon, onPress, primary = false, disabled = false, styles }: ActionButtonProps) {
  return (
    <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.actionButton, primary && styles.actionPrimary, disabled && styles.disabled]}>
      {icon}
      <Text style={[styles.actionText, primary && styles.primaryText]}>{label}</Text>
    </TouchableOpacity>
  );
}

type ClassFormFieldsProps = { form: ClassScheduleForm; onChange: (form: ClassScheduleForm) => void; validationMessage: string | null; styles: Styles; colors: AppThemeColors };
function ClassFormFields({ form, onChange, validationMessage, styles, colors }: ClassFormFieldsProps) {
  const endOptions = SCHEDULE_END_SLOTS.filter((time) => scheduleService.parseHour(time) > scheduleService.parseHour(form.startTime));
  const handleStartChange = (startTime: string) => {
    const endTime = scheduleService.parseHour(form.endTime) > scheduleService.parseHour(startTime) ? form.endTime : `${scheduleService.parseHour(startTime) + 1}:00`;
    onChange({ ...form, startTime, endTime });
  };

  return (
    <>
      {validationMessage ? <View style={styles.alert}><Text style={styles.alertText}>{validationMessage}</Text></View> : null}
      <View style={styles.field}>
        <Text style={styles.label}>Subject *</Text>
        <TextInput value={form.subject} onChangeText={(subject) => onChange({ ...form, subject })} placeholder="e.g. CSEC Mathematics" placeholderTextColor={colors.mutedText} style={styles.input} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Day</Text>
        <View style={styles.segmented}>
          {SCHEDULE_DAYS.map((day) => (
            <TouchableOpacity key={day} accessibilityRole="radio" accessibilityState={{ selected: form.day === day }} onPress={() => onChange({ ...form, day })} style={[styles.segment, form.day === day && styles.segmentActive]}>
              <Text style={[styles.segmentText, form.day === day && styles.segmentTextActive]}>{day.slice(0, 3)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TimeChips label="Starts" options={SCHEDULE_START_SLOTS} value={form.startTime} onSelect={handleStartChange} styles={styles} />
      <TimeChips label="Ends" options={endOptions} value={form.endTime} onSelect={(endTime) => onChange({ ...form, endTime })} styles={styles} />
      <View style={styles.field}>
        <Text style={styles.label}>Colour</Text>
        <View style={styles.swatches}>
          {CLASS_COLORS.map((swatch) => {
            const isSelected = form.color.toLowerCase() === swatch.value;
            return (
              <TouchableOpacity key={swatch.value} accessibilityRole="radio" accessibilityLabel={swatch.name} accessibilityState={{ selected: isSelected }} onPress={() => onChange({ ...form, color: swatch.value })} style={[styles.swatch, { backgroundColor: swatch.value }, isSelected && { borderColor: swatch.value, borderWidth: 2 }]}>
                {isSelected ? <Check size={16} color="#ffffff" strokeWidth={3} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={styles.field}>
        <View style={styles.toggleRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>Repeat this class</Text>
            <Text style={styles.small}>{form.recurringType === 'monthly' ? 'Adds it for the next 3 months.' : 'Adds it for the next 4 weeks.'}</Text>
          </View>
          <Switch value={form.isRecurring} onValueChange={(isRecurring) => onChange({ ...form, isRecurring })} trackColor={{ true: GREEN, false: colors.border }} thumbColor="#ffffff" />
        </View>
        {form.isRecurring ? (
          <View style={styles.segmented}>
            {(['weekly', 'monthly'] as const).map((recurringType) => (
              <TouchableOpacity key={recurringType} accessibilityRole="radio" accessibilityState={{ selected: form.recurringType === recurringType }} onPress={() => onChange({ ...form, recurringType })} style={[styles.segment, form.recurringType === recurringType && styles.segmentActive]}>
                <Text style={[styles.segmentText, form.recurringType === recurringType && styles.segmentTextActive]}>{recurringType === 'weekly' ? 'Weekly' : 'Monthly'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Remind me by</Text>
        <View style={styles.chipRow}>
          <ToggleChip label="Email" icon={<Mail size={15} color={form.reminders.email ? colors.accentText : colors.mutedText} />} pressed={form.reminders.email} onPress={() => onChange({ ...form, reminders: { ...form.reminders, email: !form.reminders.email } })} styles={styles} />
          <ToggleChip label="WhatsApp" icon={<MessageCircle size={15} color={form.reminders.whatsapp ? colors.accentText : colors.mutedText} />} pressed={form.reminders.whatsapp} onPress={() => onChange({ ...form, reminders: { ...form.reminders, whatsapp: !form.reminders.whatsapp } })} styles={styles} />
        </View>
      </View>
    </>
  );
}

type TimeChipsProps = { label: string; options: string[]; value: string; onSelect: (time: string) => void; styles: Styles };
function TimeChips({ label, options, value, onSelect, styles }: TimeChipsProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
        {options.map((time) => (
          <TouchableOpacity key={time} accessibilityRole="radio" accessibilityState={{ selected: value === time }} onPress={() => onSelect(time)} style={[styles.timeChip, value === time && styles.segmentActive]}>
            <Text style={[styles.segmentText, value === time && styles.segmentTextActive]}>{scheduleService.formatHour(time)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

type ToggleChipProps = { label: string; icon: ReactNode; pressed: boolean; onPress: () => void; styles: Styles };
function ToggleChip({ label, icon, pressed, onPress, styles }: ToggleChipProps) {
  return (
    <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: pressed }} onPress={onPress} style={[styles.toggleChip, pressed && styles.toggleChipActive]}>
      {icon}
      <Text style={[styles.segmentText, pressed && styles.toggleChipActiveText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TimetableSkeleton({ styles }: { styles: Styles }) {
  return (
    <View style={styles.gridFrame}>
      <View style={styles.skeletonHeader}>
        {SCHEDULE_DAYS.map((day) => <Skeleton key={day} width={44} height={14} borderRadius={7} />)}
      </View>
      <View style={styles.skeletonBody}>
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <View key={row} style={styles.skeletonRow}>
            <Skeleton width={34} height={10} borderRadius={5} />
            <Skeleton width={row % 2 === 0 ? '60%' : '40%'} height={row % 3 === 0 ? 72 : 44} borderRadius={10} />
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 12 },
  headerCopy: { gap: 2 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  small: { color: colors.mutedText, fontSize: 12 },
  center: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, paddingHorizontal: 12 },
  actionPrimary: { backgroundColor: GREEN, borderColor: GREEN },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  errorCard: { backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 14, gap: 10 },
  errorText: { color: colors.destructiveText, fontSize: 13 },
  retryButton: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 18 },
  inlineButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  emptyCard: { alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, paddingHorizontal: 20, paddingVertical: 20 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface, marginBottom: 4 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },

  gridFrame: { borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  dayHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.control },
  dayHeader: { width: DAY_COLUMN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  dayHeaderText: { color: colors.secondaryText, fontSize: 13, fontWeight: '600' },
  todayBadge: { color: '#ffffff', backgroundColor: GREEN, fontSize: 9, fontWeight: '800', borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  gridBody: { flexDirection: 'row' },
  hourLabel: { height: HOUR_ROW, paddingRight: 6, paddingTop: 3, textAlign: 'right', color: colors.mutedText, fontSize: 11 },
  dayColumn: { width: DAY_COLUMN, borderLeftWidth: 1, borderLeftColor: colors.border },
  todayColumn: { backgroundColor: colors.successSurface },
  hourCell: { height: HOUR_ROW, borderTopWidth: 1, borderTopColor: colors.border },
  firstHourCell: { borderTopWidth: 0 },
  block: { position: 'absolute', left: 4, right: 4, overflow: 'hidden', borderRadius: 8, borderLeftWidth: 4 },
  blockButton: { flex: 1, paddingLeft: 8, paddingRight: 22, paddingVertical: 5, gap: 1 },
  blockTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  blockTime: { color: colors.secondaryText, fontSize: 10 },
  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 'auto' },
  selectToggle: { position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.mutedText, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  selectToggleActive: { borderColor: GREEN, backgroundColor: GREEN },
  skeletonHeader: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  skeletonBody: { padding: 12, gap: 14 },
  skeletonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

  field: { gap: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15, paddingHorizontal: 14 },
  alert: { borderRadius: 12, borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.destructiveSurface, paddingHorizontal: 12, paddingVertical: 10 },
  alertText: { color: colors.destructiveText, fontSize: 13 },
  segmented: { flexDirection: 'row', gap: 4, borderRadius: 12, backgroundColor: colors.control, padding: 4 },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  segmentActive: { backgroundColor: GREEN },
  segmentText: { color: colors.secondaryText, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: '#ffffff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { minHeight: 34, justifyContent: 'center', borderRadius: 999, backgroundColor: colors.control, paddingHorizontal: 12 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleChip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  toggleChipActive: { borderColor: GREEN, backgroundColor: colors.successSurface },
  toggleChipActiveText: { color: colors.accentText },

  footerButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 16 },
  primaryButton: { backgroundColor: GREEN },
  secondaryButton: { backgroundColor: colors.control },
  deleteButton: { marginRight: 'auto' },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '600' },

  templateList: { gap: 8 },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  templateSubject: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  templateCard: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4 },
  templateName: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  emptyTemplates: { alignItems: 'center', gap: 6, paddingVertical: 20 },
});
