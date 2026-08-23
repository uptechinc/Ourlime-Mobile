import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Modal,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import {
	CalendarClock,
	Edit3,
	History,
	Plus,
	StickyNote,
	Trash2,
	X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import {
	jobManagementService,
	type EmployerNote,
	type InterviewType,
	type JobAuditEntry,
	type ManagedJob,
	type ManagedJobApplication,
	type ScheduleInterviewInput,
	type UpdateManagedJobInput,
} from '@/lib/services/JobManagementService';

type JobManagementNotesSheetProps = {
	application: ManagedJobApplication | null;
	jobId: string;
	onClose: () => void;
};

export function JobManagementNotesSheet({
	application,
	jobId,
	onClose,
}: JobManagementNotesSheetProps) {
	const { colors } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const [notes, setNotes] = useState<EmployerNote[]>([]);
	const [content, setContent] = useState('');
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const loadNotes = useCallback(async () => {
		if (!application) return;
		setLoading(true);
		setError('');
		try {
			setNotes(await jobManagementService.listNotes(application.id));
		} catch (loadError: unknown) {
			setError(
				loadError instanceof Error
					? loadError.message
					: 'Notes could not be loaded.'
			);
		} finally {
			setLoading(false);
		}
	}, [application]);

	useEffect(() => {
		if (application) void loadNotes();
		else {
			setNotes([]);
			setContent('');
			setError('');
		}
	}, [application, loadNotes]);

	const handleAdd = async () => {
		if (!application || !content.trim()) return;
		setSaving(true);
		setError('');
		try {
			await jobManagementService.addNote(jobId, application.id, content);
			setContent('');
			await loadNotes();
		} catch (saveError: unknown) {
			setError(
				saveError instanceof Error
					? saveError.message
					: 'The note could not be saved.'
			);
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (noteId: string) => {
		if (!application) return;
		setSaving(true);
		setError('');
		try {
			await jobManagementService.deleteNote(jobId, application.id, noteId);
			setNotes((currentNotes) =>
				currentNotes.filter((note) => note.id !== noteId)
			);
		} catch (deleteError: unknown) {
			setError(
				deleteError instanceof Error
					? deleteError.message
					: 'The note could not be deleted.'
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal
			visible={Boolean(application)}
			transparent
			statusBarTranslucent
			navigationBarTranslucent
			animationType="none"
			presentationStyle="overFullScreen"
			onRequestClose={onClose}
		>
			<SwipeDismissSurface
				visible={Boolean(application)}
				onDismiss={onClose}
				handleColor={colors.border}
				disabled={saving}
				accessibilityLabel="Swipe down to close private notes"
				style={styles.safeArea}
			>
				<SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
					<SheetHeader
						title="Private Notes"
						subtitle={application?.applicant.name ?? ''}
						icon="notes"
						onClose={onClose}
					/>
					<View style={styles.composer}>
						<TextInput
							value={content}
							onChangeText={setContent}
							placeholder="Add a private note about this applicant…"
							placeholderTextColor={colors.mutedText}
							multiline
							maxLength={1200}
							style={styles.multilineInput}
						/>
						<TouchableOpacity
							disabled={saving || !content.trim()}
							onPress={() => void handleAdd()}
							style={[
								styles.primaryButton,
								(saving || !content.trim()) && styles.disabled,
							]}
						>
							{saving ? (
								<ActivityIndicator size="small" color="#ffffff" />
							) : (
								<>
									<Plus size={16} color="#ffffff" />
									<Text style={styles.primaryButtonText}>Add Note</Text>
								</>
							)}
						</TouchableOpacity>
					</View>
					{error ? <Text style={styles.error}>{error}</Text> : null}
					{loading ? (
						<ActivityIndicator style={styles.loader} color="#10b981" />
					) : (
						<ScrollView contentContainerStyle={styles.sheetContent}>
							{notes.length === 0 ? (
								<EmptyState icon="notes" title="No private notes yet" />
							) : (
								notes.map((note) => (
									<View key={note.id} style={styles.noteCard}>
										<Text style={styles.bodyText}>{note.content}</Text>
										<View style={styles.cardFooter}>
											<Text style={styles.timestamp}>
												{formatTime(note.createdAtMs)}
											</Text>
											<TouchableOpacity
												disabled={saving}
												onPress={() => void handleDelete(note.id)}
												hitSlop={10}
											>
												<Trash2 size={17} color="#c64d53" />
											</TouchableOpacity>
										</View>
									</View>
								))
							)}
						</ScrollView>
					)}
				</SafeAreaView>
			</SwipeDismissSurface>
		</Modal>
	);
}

type JobManagementAuditSheetProps = {
	job: ManagedJob | null;
	onClose: () => void;
};

export function JobManagementAuditSheet({
	job,
	onClose,
}: JobManagementAuditSheetProps) {
	const { colors } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const [entries, setEntries] = useState<JobAuditEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!job) {
			setEntries([]);
			setError('');
			return;
		}
		let active = true;
		setLoading(true);
		setError('');
		void jobManagementService
			.listAuditHistory(job.id, 50)
			.then((history) => {
				if (active) setEntries(history);
			})
			.catch((loadError: unknown) => {
				if (active)
					setError(
						loadError instanceof Error
							? loadError.message
							: 'Activity could not be loaded.'
					);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [job]);

	return (
		<Modal
			visible={Boolean(job)}
			transparent
			statusBarTranslucent
			navigationBarTranslucent
			animationType="none"
			presentationStyle="overFullScreen"
			onRequestClose={onClose}
		>
			<SwipeDismissSurface
				visible={Boolean(job)}
				onDismiss={onClose}
				handleColor={colors.border}
				disabled={loading}
				accessibilityLabel="Swipe down to close job activity"
				style={styles.safeArea}
			>
				<SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
					<SheetHeader
						title="Activity History"
						subtitle={job?.title ?? ''}
						icon="history"
						onClose={onClose}
					/>
					{error ? <Text style={styles.error}>{error}</Text> : null}
					{loading ? (
						<ActivityIndicator style={styles.loader} color="#10b981" />
					) : (
						<ScrollView contentContainerStyle={styles.sheetContent}>
							{entries.length === 0 ? (
								<EmptyState icon="history" title="No activity recorded yet" />
							) : (
								entries.map((entry) => (
									<View key={entry.id} style={styles.auditCard}>
										<View style={styles.auditHeader}>
											<Text style={styles.auditAction}>
												{entry.action.replaceAll('_', ' ')}
											</Text>
											<Text style={styles.timestamp}>
												{formatTime(entry.createdAtMs)}
											</Text>
										</View>
										<Text style={styles.bodyText}>{entry.details}</Text>
										{entry.previousValue && entry.newValue ? (
											<Text style={styles.changeText}>
												{entry.previousValue} → {entry.newValue}
											</Text>
										) : null}
									</View>
								))
							)}
						</ScrollView>
					)}
				</SafeAreaView>
			</SwipeDismissSurface>
		</Modal>
	);
}

type JobManagementInterviewSheetProps = {
	application: ManagedJobApplication | null;
	job: ManagedJob | null;
	onClose: () => void;
	onScheduled: () => Promise<void>;
};

const interviewTypes: InterviewType[] = ['video', 'phone', 'in-person'];
const interviewDurations = [15, 30, 45, 60, 90];

export function JobManagementInterviewSheet({
	application,
	job,
	onClose,
	onScheduled,
}: JobManagementInterviewSheetProps) {
	const { colors } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const [date, setDate] = useState('');
	const [time, setTime] = useState('');
	const [duration, setDuration] = useState(30);
	const [type, setType] = useState<InterviewType>('video');
	const [location, setLocation] = useState('');
	const [notes, setNotes] = useState('');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!application) {
			setDate('');
			setTime('');
			setDuration(30);
			setType('video');
			setLocation('');
			setNotes('');
			setError('');
		}
	}, [application]);

	const handleSchedule = async () => {
		if (!application || !job) return;
		const scheduledDate = new Date(`${date}T${time}`);
		if (!date || !time || Number.isNaN(scheduledDate.getTime())) {
			setError(
				'Enter a valid date and time, for example 2026-08-24 and 14:30.'
			);
			return;
		}
		if (scheduledDate.getTime() <= Date.now()) {
			setError('Interview time must be in the future.');
			return;
		}
		if (type === 'in-person' && !location.trim()) {
			setError('Add a location for an in-person interview.');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const input: ScheduleInterviewInput = {
				applicationId: application.id,
				jobId: job.id,
				applicantId: application.userId,
				applicantName: application.applicant.name,
				jobTitle: job.title,
				scheduledAt: scheduledDate.toISOString(),
				duration,
				type,
				...(location.trim() ? { location: location.trim() } : {}),
				...(notes.trim() ? { notes: notes.trim() } : {}),
			};
			await jobManagementService.scheduleInterview(input);
			await onScheduled();
			onClose();
		} catch (scheduleError: unknown) {
			setError(
				scheduleError instanceof Error
					? scheduleError.message
					: 'The interview could not be scheduled.'
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal
			visible={Boolean(application && job)}
			transparent
			statusBarTranslucent
			navigationBarTranslucent
			animationType="none"
			presentationStyle="overFullScreen"
			onRequestClose={onClose}
		>
			<SwipeDismissSurface
				visible={Boolean(application && job)}
				onDismiss={onClose}
				handleColor={colors.border}
				disabled={saving}
				accessibilityLabel="Swipe down to close interview scheduling"
				style={styles.safeArea}
			>
				<SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
					<SheetHeader
						title="Schedule Interview"
						subtitle={`${application?.applicant.name ?? ''} · ${job?.title ?? ''}`}
						icon="interview"
						onClose={onClose}
					/>
					<ScrollView
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={styles.formContent}
					>
						<FormLabel label="Date (YYYY-MM-DD)" />
						<TextInput
							value={date}
							onChangeText={setDate}
							placeholder="2026-08-24"
							placeholderTextColor={colors.mutedText}
							autoCapitalize="none"
							keyboardType="numbers-and-punctuation"
							style={styles.input}
						/>
						<FormLabel label="Time (24-hour HH:MM)" />
						<TextInput
							value={time}
							onChangeText={setTime}
							placeholder="14:30"
							placeholderTextColor={colors.mutedText}
							autoCapitalize="none"
							keyboardType="numbers-and-punctuation"
							style={styles.input}
						/>
						<FormLabel label="Duration" />
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.chipRow}
						>
							{interviewDurations.map((durationOption) => (
								<ChoiceChip
									key={durationOption}
									label={`${durationOption} min`}
									active={duration === durationOption}
									onPress={() => setDuration(durationOption)}
								/>
							))}
						</ScrollView>
						<FormLabel label="Interview type" />
						<View style={styles.typeRow}>
							{interviewTypes.map((typeOption) => (
								<ChoiceChip
									key={typeOption}
									label={typeOption}
									active={type === typeOption}
									onPress={() => setType(typeOption)}
								/>
							))}
						</View>
						{type === 'in-person' ? (
							<>
								<FormLabel label="Location" />
								<TextInput
									value={location}
									onChangeText={setLocation}
									placeholder="Interview location"
									placeholderTextColor={colors.mutedText}
									style={styles.input}
								/>
							</>
						) : null}
						<FormLabel label="Notes (optional)" />
						<TextInput
							value={notes}
							onChangeText={setNotes}
							placeholder="Add interview instructions…"
							placeholderTextColor={colors.mutedText}
							multiline
							maxLength={1000}
							style={styles.multilineInput}
						/>
						{error ? <Text style={styles.errorInline}>{error}</Text> : null}
						<TouchableOpacity
							disabled={saving}
							onPress={() => void handleSchedule()}
							style={[styles.primaryButton, saving && styles.disabled]}
						>
							{saving ? (
								<ActivityIndicator color="#ffffff" />
							) : (
								<>
									<CalendarClock size={17} color="#ffffff" />
									<Text style={styles.primaryButtonText}>
										Schedule Interview
									</Text>
								</>
							)}
						</TouchableOpacity>
					</ScrollView>
				</SafeAreaView>
			</SwipeDismissSurface>
		</Modal>
	);
}

type JobManagementEditSheetProps = {
	job: ManagedJob | null;
	onClose: () => void;
	onSaved: () => Promise<void>;
};

export function JobManagementEditSheet({
	job,
	onClose,
	onSaved,
}: JobManagementEditSheetProps) {
	const { colors } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [category, setCategory] = useState('');
	const [priceFrom, setPriceFrom] = useState('');
	const [priceTo, setPriceTo] = useState('');
	const [locationType, setLocationType] = useState('remote');
	const [city, setCity] = useState('');
	const [country, setCountry] = useState('');
	const [skills, setSkills] = useState('');
	const [requirements, setRequirements] = useState('');
	const [qualifications, setQualifications] = useState('');
	const [companyName, setCompanyName] = useState('');
	const [industry, setIndustry] = useState('');
	const [duration, setDuration] = useState('');
	const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!job) return;
		setTitle(job.title);
		setDescription(job.description);
		setCategory(job.category);
		setPriceFrom(String(job.priceRange.from));
		setPriceTo(String(job.priceRange.to));
		setLocationType(job.locationDetails.type);
		setCity(job.locationDetails.city);
		setCountry(job.locationDetails.country);
		setSkills(job.skills.join(', '));
		setRequirements(job.requirements.join(', '));
		setQualifications(job.qualifications.join(', '));
		setCompanyName(job.categoryDetails.name);
		setIndustry(job.categoryDetails.industry);
		setDuration(job.categoryDetails.duration);
		setDisclaimerAccepted(false);
		setError('');
	}, [job]);

	const handleSave = async () => {
		if (!job) return;
		if (!disclaimerAccepted) {
			setError(
				'Confirm the Job Poster Disclaimer before saving listing changes.'
			);
			return;
		}
		const from = Number(priceFrom);
		const to = Number(priceTo);
		if (!Number.isFinite(from) || !Number.isFinite(to)) {
			setError('Enter a valid compensation range.');
			return;
		}
		const splitValues = (value: string) =>
			value
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean);
		const input: UpdateManagedJobInput = {
			title,
			description,
			category,
			priceRange: { from, to },
			location: {
				type: locationType.trim() || 'remote',
				address: job.locationDetails.address,
				city: city.trim(),
				country: country.trim(),
			},
			skills: splitValues(skills),
			requirements: splitValues(requirements),
			qualifications: splitValues(qualifications),
			categoryDetails: {
				...job.categoryDetails,
				name: companyName.trim(),
				industry: industry.trim(),
				duration: duration.trim(),
			},
			questions: job.questions,
		};
		setSaving(true);
		setError('');
		try {
			await jobManagementService.updateJob(job.id, input);
			await onSaved();
			onClose();
		} catch (saveError: unknown) {
			setError(
				saveError instanceof Error
					? saveError.message
					: 'The job could not be updated.'
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal
			visible={Boolean(job)}
			transparent
			statusBarTranslucent
			navigationBarTranslucent
			animationType="none"
			presentationStyle="overFullScreen"
			onRequestClose={onClose}
		>
			<SwipeDismissSurface
				visible={Boolean(job)}
				onDismiss={onClose}
				handleColor={colors.border}
				disabled={saving}
				accessibilityLabel="Swipe down to close job editor"
				style={styles.safeArea}
			>
				<SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
					<SheetHeader
						title="Edit Job"
						subtitle={
							job?.type === 'quickTask' ? 'Quick Task' : 'Professional Job'
						}
						icon="edit"
						onClose={onClose}
					/>
					<ScrollView
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={styles.formContent}
					>
						<FormLabel label="Title" />
						<TextInput
							value={title}
							onChangeText={setTitle}
							placeholder="Listing title"
							placeholderTextColor={colors.mutedText}
							style={styles.input}
						/>
						<FormLabel label="Description" />
						<TextInput
							value={description}
							onChangeText={setDescription}
							placeholder="Describe the opportunity"
							placeholderTextColor={colors.mutedText}
							multiline
							maxLength={5000}
							style={styles.multilineInput}
						/>
						<FormLabel label="Category" />
						<TextInput
							value={category}
							onChangeText={setCategory}
							placeholder="Category"
							placeholderTextColor={colors.mutedText}
							style={styles.input}
						/>
						<View style={styles.twoColumn}>
							<View style={styles.flexField}>
								<FormLabel label="Compensation from" />
								<TextInput
									value={priceFrom}
									onChangeText={setPriceFrom}
									keyboardType="decimal-pad"
									placeholder="0"
									placeholderTextColor={colors.mutedText}
									style={styles.input}
								/>
							</View>
							<View style={styles.flexField}>
								<FormLabel label="Compensation to" />
								<TextInput
									value={priceTo}
									onChangeText={setPriceTo}
									keyboardType="decimal-pad"
									placeholder="0"
									placeholderTextColor={colors.mutedText}
									style={styles.input}
								/>
							</View>
						</View>
						<FormLabel label="Location type" />
						<TextInput
							value={locationType}
							onChangeText={setLocationType}
							placeholder="remote, hybrid, on-site"
							placeholderTextColor={colors.mutedText}
							style={styles.input}
						/>
						<View style={styles.twoColumn}>
							<View style={styles.flexField}>
								<FormLabel label="City" />
								<TextInput
									value={city}
									onChangeText={setCity}
									placeholder="City"
									placeholderTextColor={colors.mutedText}
									style={styles.input}
								/>
							</View>
							<View style={styles.flexField}>
								<FormLabel label="Country" />
								<TextInput
									value={country}
									onChangeText={setCountry}
									placeholder="Country"
									placeholderTextColor={colors.mutedText}
									style={styles.input}
								/>
							</View>
						</View>
						<FormLabel label="Skills (comma separated)" />
						<TextInput
							value={skills}
							onChangeText={setSkills}
							placeholder="TypeScript, Design"
							placeholderTextColor={colors.mutedText}
							style={styles.input}
						/>
						<FormLabel label="Requirements (comma separated)" />
						<TextInput
							value={requirements}
							onChangeText={setRequirements}
							placeholder="Requirements"
							placeholderTextColor={colors.mutedText}
							style={styles.input}
						/>
						<FormLabel label="Qualifications (comma separated)" />
						<TextInput
							value={qualifications}
							onChangeText={setQualifications}
							placeholder="Qualifications"
							placeholderTextColor={colors.mutedText}
							style={styles.input}
						/>
						{job?.type === 'professional' ? (
							<>
								<FormLabel label="Company name" />
								<TextInput
									value={companyName}
									onChangeText={setCompanyName}
									placeholder="Company"
									placeholderTextColor={colors.mutedText}
									style={styles.input}
								/>
								<FormLabel label="Industry" />
								<TextInput
									value={industry}
									onChangeText={setIndustry}
									placeholder="Industry"
									placeholderTextColor={colors.mutedText}
									style={styles.input}
								/>
							</>
						) : (
							<>
								<FormLabel label="Expected duration" />
								<TextInput
									value={duration}
									onChangeText={setDuration}
									placeholder="2 days"
									placeholderTextColor={colors.mutedText}
									style={styles.input}
								/>
							</>
						)}
						<View style={styles.disclaimer}>
							<View style={styles.disclaimerCopy}>
								<Text style={styles.disclaimerTitle}>
									Job Poster Disclaimer
								</Text>
								<Text style={styles.disclaimerText}>
									I confirm this is a genuine, lawful listing; its compensation,
									location and requirements are accurate; and I will not request
									fees, passwords, financial credentials, verification codes or
									unrelated identity documents.
								</Text>
							</View>
							<Switch
								value={disclaimerAccepted}
								onValueChange={setDisclaimerAccepted}
								trackColor={{ true: '#10b981' }}
							/>
						</View>
						{job?.applications.length ? (
							<Text style={styles.notice}>
								This job has {job.applications.length} application(s), so its
								opportunity type remains locked.
							</Text>
						) : null}
						{error ? <Text style={styles.errorInline}>{error}</Text> : null}
						<TouchableOpacity
							disabled={saving}
							onPress={() => void handleSave()}
							style={[styles.primaryButton, saving && styles.disabled]}
						>
							{saving ? (
								<ActivityIndicator color="#ffffff" />
							) : (
								<>
									<Edit3 size={17} color="#ffffff" />
									<Text style={styles.primaryButtonText}>Save Changes</Text>
								</>
							)}
						</TouchableOpacity>
					</ScrollView>
				</SafeAreaView>
			</SwipeDismissSurface>
		</Modal>
	);
}

type SheetHeaderProps = {
	title: string;
	subtitle: string;
	icon: 'notes' | 'history' | 'interview' | 'edit';
	onClose: () => void;
};
function SheetHeader({ title, subtitle, icon, onClose }: SheetHeaderProps) {
	const { colors } = useAppTheme();
	const Icon =
		icon === 'notes'
			? StickyNote
			: icon === 'history'
				? History
				: icon === 'edit'
					? Edit3
					: CalendarClock;
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 10,
				padding: 16,
				borderBottomWidth: 1,
				borderBottomColor: colors.border,
				backgroundColor: colors.surface,
			}}
		>
			<Icon size={22} color="#10b981" />
			<View style={{ flex: 1 }}>
				<Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>
					{title}
				</Text>
				{subtitle ? (
					<Text
						numberOfLines={1}
						style={{ color: colors.mutedText, fontSize: 11, marginTop: 2 }}
					>
						{subtitle}
					</Text>
				) : null}
			</View>
			<TouchableOpacity onPress={onClose} hitSlop={10}>
				<X size={23} color={colors.icon} />
			</TouchableOpacity>
		</View>
	);
}

type EmptyStateProps = { icon: 'notes' | 'history'; title: string };
function EmptyState({ icon, title }: EmptyStateProps) {
	const { colors } = useAppTheme();
	const Icon = icon === 'notes' ? StickyNote : History;
	return (
		<View style={{ alignItems: 'center', gap: 9, paddingVertical: 56 }}>
			<Icon size={36} color={colors.mutedText} />
			<Text style={{ color: colors.mutedText, fontWeight: '800' }}>
				{title}
			</Text>
		</View>
	);
}

type ChoiceChipProps = { label: string; active: boolean; onPress: () => void };
function ChoiceChip({ label, active, onPress }: ChoiceChipProps) {
	const { colors } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	return (
		<TouchableOpacity
			onPress={onPress}
			style={[styles.choiceChip, active && styles.choiceChipActive]}
		>
			<Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

function FormLabel({ label }: { label: string }) {
	const { colors } = useAppTheme();
	return (
		<Text
			style={{
				color: colors.secondaryText,
				fontSize: 12,
				fontWeight: '800',
				marginTop: 15,
				marginBottom: 6,
			}}
		>
			{label}
		</Text>
	);
}

function formatTime(timestampMs: number): string {
	if (!timestampMs) return 'Just now';
	return new Date(timestampMs).toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
const createStyles = (colors: ThemeColors) =>
	StyleSheet.create({
		safeArea: { flex: 1, backgroundColor: colors.canvas },
		composer: {
			padding: 16,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
			backgroundColor: colors.surface,
			gap: 10,
		},
		multilineInput: {
			minHeight: 92,
			textAlignVertical: 'top',
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: 14,
			backgroundColor: colors.input,
			color: colors.text,
			padding: 12,
		},
		input: {
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: 14,
			backgroundColor: colors.input,
			color: colors.text,
			padding: 12,
		},
		primaryButton: {
			minHeight: 45,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			gap: 7,
			borderRadius: 14,
			backgroundColor: '#10b981',
			paddingHorizontal: 16,
		},
		primaryButtonText: { color: '#ffffff', fontWeight: '900' },
		disabled: { opacity: 0.5 },
		loader: { marginTop: 48 },
		error: {
			margin: 16,
			color: colors.destructiveText,
			backgroundColor: colors.destructiveSurface,
			borderRadius: 12,
			padding: 11,
		},
		errorInline: {
			color: colors.destructiveText,
			backgroundColor: colors.destructiveSurface,
			borderRadius: 12,
			padding: 11,
			marginVertical: 14,
		},
		sheetContent: { padding: 16, paddingBottom: 50, gap: 11 },
		formContent: { padding: 18, paddingBottom: 50 },
		noteCard: {
			borderWidth: 1,
			borderColor: colors.warningText,
			borderRadius: 14,
			backgroundColor: colors.warningSurface,
			padding: 13,
		},
		auditCard: {
			borderLeftWidth: 4,
			borderLeftColor: '#10b981',
			borderRadius: 12,
			backgroundColor: colors.surface,
			padding: 13,
		},
		auditHeader: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 8,
			marginBottom: 7,
		},
		auditAction: {
			flex: 1,
			color: colors.successText,
			fontSize: 11,
			fontWeight: '900',
			textTransform: 'capitalize',
		},
		bodyText: { color: colors.text, fontSize: 13, lineHeight: 19 },
		changeText: { color: colors.mutedText, fontSize: 11, marginTop: 7 },
		cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
		timestamp: { flex: 1, color: colors.mutedText, fontSize: 10 },
		chipRow: { gap: 8 },
		choiceChip: {
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.input,
			borderRadius: 999,
			paddingHorizontal: 12,
			paddingVertical: 9,
		},
		choiceChipActive: {
			backgroundColor: colors.accent,
			borderColor: colors.accent,
		},
		choiceLabel: {
			color: colors.secondaryText,
			fontSize: 12,
			fontWeight: '800',
			textTransform: 'capitalize',
		},
		choiceLabelActive: { color: colors.onAccent },
		typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
		twoColumn: { flexDirection: 'row', gap: 10 },
		flexField: { flex: 1 },
		disclaimer: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 12,
			marginTop: 18,
			borderRadius: 15,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.surface,
			padding: 13,
		},
		disclaimerCopy: { flex: 1 },
		disclaimerTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
		disclaimerText: {
			color: colors.mutedText,
			fontSize: 10,
			lineHeight: 15,
			marginTop: 4,
		},
		notice: {
			color: colors.warningText,
			backgroundColor: colors.warningSurface,
			borderRadius: 12,
			padding: 11,
			marginTop: 13,
			fontSize: 11,
		},
	});
