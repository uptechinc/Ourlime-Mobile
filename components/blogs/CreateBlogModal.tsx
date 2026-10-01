import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  AlertCircle, AlignLeft, ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle, Clock, Eye,
  FileEdit, FileText, Hash, ImageIcon, Layers, Link2, Plus, Save, Shield, Sparkles, Trash2, X,
} from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { BlogsAndArticlesService } from '@/lib/blogs&articles/BlogsAndArticlesService';
import RichTextEditor from '@/components/blogs/RichTextEditor';
import RichBlogContent from '@/components/blog/RichBlogContent';
import { stripHtml } from '@/lib/utils/htmlUtils';
import type { BlogEditorDraft, BlogEditorSource, BlogPostDetail, BlogSubmitStatus } from '@/lib/types/blog';

type CreateBlogModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess?: () => void;
  /** Edit mode (web: editBlogId + initialData) — submits PATCH instead of POST. */
  editBlogId?: string;
  initialData?: BlogPostDetail;
};

type EditorField = 'title' | 'excerpt' | 'content' | 'categoryId' | 'coverImage';

type NoticeState = { type: 'success' | 'error'; title: string; message: string } | null;

type AutosaveStatus = 'idle' | 'saving' | 'saved';

// Kept identical to Ourlime-Web components/blogs/CreateBlogModal.tsx.
const STEPS = [
  { id: 'basics', label: 'Basics', icon: AlignLeft },
  { id: 'content', label: 'Content', icon: BookOpen },
  { id: 'classification', label: 'Categorize', icon: Layers },
  { id: 'sources', label: 'Sources', icon: Link2 },
  { id: 'publish', label: 'Review', icon: Eye },
] as const;

const CATEGORIES = [
  { id: 'technology', label: 'Technology' }, { id: 'lifestyle', label: 'Lifestyle' }, { id: 'business', label: 'Business' },
  { id: 'health', label: 'Health' }, { id: 'education', label: 'Education' }, { id: 'travel', label: 'Travel' },
  { id: 'food', label: 'Food' }, { id: 'fashion', label: 'Fashion' }, { id: 'wellness', label: 'Wellness' },
  { id: 'marketing', label: 'Marketing' }, { id: 'finance', label: 'Finance' }, { id: 'design', label: 'Design' },
] as const;

const POPULAR_TAGS = ['Technology', 'Wellness', 'Sustainability', 'Marketing', 'Finance', 'Productivity', 'Innovation', 'Mental Health', 'Remote Work', 'Artificial Intelligence', 'Design', 'Startup', 'Education', 'Health', 'Lifestyle'];
const MAX_TAGS = 5;
const MAX_EXCERPT = 200;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const AUTHOR_DISCLAIMER_VERSION = '2026-08-25';

const blogService = BlogsAndArticlesService.getInstance();

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export default function CreateBlogModal({ isOpen, onClose, userId, onSuccess, editBlogId, initialData }: CreateBlogModalProps) {
  const { colors, isDark } = useAppTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<BlogEditorDraft>(() => blogService.createDraft());
  const [errors, setErrors] = useState<Partial<Record<EditorField, string>>>({});
  const [tagInput, setTagInput] = useState('');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState<BlogSubmitStatus | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [datePickerIndex, setDatePickerIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const contentText = useMemo(() => stripHtml(formData.content), [formData.content]);
  const wordCount = useMemo(() => countWords(contentText), [contentText]);
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  const isBusy = submittingStatus !== null || isUploadingCover;

  // Restore the autosaved draft each time the editor opens (web: localStorage restore).
  useEffect(() => {
    if (!isOpen) {
      setIsDraftReady(false);
      setCurrentStep(0); setErrors({}); setDisclaimerAccepted(false); setTagInput('');
      return;
    }
    let cancelled = false;
    if (initialData) {
      setFormData(blogService.toEditorDraft(initialData));
      setIsDraftReady(true);
      return;
    }
    void blogService.loadDraft(userId, editBlogId).then((draft) => {
      if (cancelled) return;
      setFormData(draft ?? blogService.createDraft());
      setIsDraftReady(true);
    });
    return () => { cancelled = true; };
  }, [editBlogId, initialData, isOpen, userId]);

  // Autosave 3s after the last edit, matching the web editor.
  useEffect(() => {
    if (!isOpen || !isDraftReady) return;
    const timer = setTimeout(() => {
      setAutosaveStatus('saving');
      void blogService.saveDraft(userId, formData, editBlogId)
        .then(() => { setAutosaveStatus('saved'); setTimeout(() => setAutosaveStatus('idle'), 2000); })
        .catch(() => setAutosaveStatus('idle'));
    }, 3000);
    return () => clearTimeout(timer);
  }, [editBlogId, formData, isDraftReady, isOpen, userId]);

  const updateField = <TField extends keyof BlogEditorDraft>(field: TField, value: BlogEditorDraft[TField]) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    if (field in errors) setErrors((previous) => { const next = { ...previous }; delete next[field as EditorField]; return next; });
  };

  const validate = useCallback((): boolean => {
    const nextErrors: Partial<Record<EditorField, string>> = {};
    if (!formData.title.trim()) nextErrors.title = 'Title is required';
    if (!formData.excerpt.trim()) nextErrors.excerpt = 'Excerpt is required';
    if (!contentText.trim()) nextErrors.content = 'Content is required';
    if (!formData.categoryId) nextErrors.categoryId = 'Category is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [contentText, formData]);

  const canProceed = (step: number): boolean => {
    if (step === 0) return formData.title.trim().length > 0;
    if (step === 1) return contentText.trim().length > 0;
    if (step === 2) return formData.categoryId.length > 0;
    return true;
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleNext = () => { if (currentStep < STEPS.length - 1 && canProceed(currentStep)) goToStep(currentStep + 1); };
  const handleBack = () => { if (currentStep > 0) goToStep(currentStep - 1); };

  const handlePickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrors((previous) => ({ ...previous, coverImage: 'Allow photo access to choose a cover image.' }));
      return;
    }
    // The system cropper at 16:9 matches the web editor's cover cropper.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.9 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    if (asset.fileSize && asset.fileSize > MAX_COVER_BYTES) {
      setErrors((previous) => ({ ...previous, coverImage: 'Image size exceeds the 5MB limit. Please upload a smaller image.' }));
      return;
    }
    if (asset.mimeType && !ALLOWED_COVER_TYPES.includes(asset.mimeType)) {
      setErrors((previous) => ({ ...previous, coverImage: 'Unsupported image format. Allowed formats: JPEG, PNG, GIF, WEBP.' }));
      return;
    }
    setIsUploadingCover(true);
    try {
      updateField('coverImage', await blogService.uploadCoverImage(asset.uri));
    } catch (error: unknown) {
      console.error('[CreateBlogModal.handlePickCover] Error:', error instanceof Error ? error.message : error);
      setErrors((previous) => ({ ...previous, coverImage: error instanceof Error ? error.message : 'Cover upload failed. Please retry.' }));
    } finally {
      setIsUploadingCover(false);
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && formData.tags.length < MAX_TAGS && !formData.tags.includes(trimmed)) updateField('tags', [...formData.tags, trimmed]);
    setTagInput('');
  };

  const removeTag = (tag: string) => updateField('tags', formData.tags.filter((existing) => existing !== tag));

  const updateSource = (index: number, field: keyof BlogEditorSource, value: string) => {
    updateField('sources', formData.sources.map((source, position) => position === index ? { ...source, [field]: value } : source));
  };

  const handleSourceDateChange = (event: DateTimePickerEvent, date?: Date) => {
    const index = datePickerIndex;
    setDatePickerIndex(null);
    if (event.type !== 'set' || !date || index === null) return;
    updateSource(index, 'publishDate', date.toISOString().split('T')[0]);
  };

  const handleSubmit = async (status: BlogSubmitStatus) => {
    if (isBusy) return;
    if (status === 'published') {
      if (!validate()) {
        setNotice({ type: 'error', title: 'Missing details', message: 'Title, excerpt, content, and category are required before publishing.' });
        return;
      }
      if (!disclaimerAccepted) {
        setNotice({ type: 'error', title: 'Disclaimer required', message: 'Please accept the Author Publishing Disclaimer before publishing.' });
        return;
      }
    }
    setSubmittingStatus(status);
    try {
      await blogService.submitPost(formData, status, disclaimerAccepted, editBlogId);
      setFormData(blogService.createDraft());
      onSuccess?.();
      setNotice({ type: 'success', title: status === 'published' ? 'Published!' : 'Draft saved', message: status === 'published' ? 'Your post is now live.' : 'Your draft was saved to your account.' });
    } catch (error: unknown) {
      console.error('[CreateBlogModal.handleSubmit] Error:', error instanceof Error ? error.message : error);
      setNotice({ type: 'error', title: status === 'published' ? 'Publish failed' : 'Save failed', message: error instanceof Error ? error.message : 'Something went wrong. Your draft is still available.' });
    } finally {
      setSubmittingStatus(null);
    }
  };

  const handleNoticeClose = () => {
    const wasSuccess = notice?.type === 'success';
    setNotice(null);
    if (wasSuccess) onClose();
  };

  const inputStyle = [styles.lineInput, { color: colors.text, borderColor: colors.border }];

  const renderError = (field: EditorField) => errors[field]
    ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors[field]}</Text>
    : null;

  const renderStepProgress = () => (
    <View style={[styles.progressWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={[styles.progressBar, { width: `${((currentStep + 1) / STEPS.length) * 100}%` }]} />
      <View style={styles.progressRow}>
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = index === currentStep;
          const isDone = index < currentStep;
          return (
            <Pressable key={step.id} disabled={index > currentStep} onPress={() => goToStep(index)} style={[styles.progressStep, index > currentStep && { opacity: 0.45 }]} accessibilityLabel={`Step ${index + 1}: ${step.label}`}>
              <View style={[styles.progressDot, { backgroundColor: isDone || isActive ? '#10b981' : colors.control }]}>
                {isDone ? <Check size={12} color="#ffffff" strokeWidth={3} /> : <StepIcon size={12} color={isActive ? '#ffffff' : colors.mutedText} />}
              </View>
              <Text style={[styles.progressLabel, { color: isActive ? colors.text : colors.mutedText }]} numberOfLines={1}>{step.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderBasics = () => (
    <View style={styles.stepBody}>
      <TextInput
        placeholder="Write your title..."
        placeholderTextColor={colors.mutedText}
        value={formData.title}
        onChangeText={(title) => updateField('title', title)}
        style={[styles.titleInput, { color: colors.text, borderColor: colors.border }]}
        multiline
      />
      {renderError('title')}

      <View style={styles.fieldHeader}>
        <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Cover Image</Text>
        <Text style={[styles.fieldHint, { color: colors.mutedText }]}>16:9 recommended</Text>
      </View>
      {formData.coverImage ? (
        <View style={[styles.coverFrame, { borderColor: colors.border }]}>
          <Image source={{ uri: formData.coverImage }} style={styles.coverImage} contentFit="cover" />
          <View style={styles.coverActions}>
            <Pressable onPress={() => void handlePickCover()} style={styles.coverActionButton} accessibilityLabel="Change cover image">
              <ImageIcon size={16} color="#0f172a" /><Text style={styles.coverActionText}>Change</Text>
            </Pressable>
            <Pressable onPress={() => updateField('coverImage', '')} style={[styles.coverActionButton, { backgroundColor: '#ef4444' }]} accessibilityLabel="Remove cover image">
              <Trash2 size={16} color="#ffffff" /><Text style={[styles.coverActionText, { color: '#ffffff' }]}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => void handlePickCover()} disabled={isUploadingCover} style={[styles.coverPlaceholder, { borderColor: colors.border, backgroundColor: colors.control }]} accessibilityLabel="Choose cover image">
          {isUploadingCover ? <ActivityIndicator color="#10b981" /> : <ImageIcon size={26} color={colors.mutedText} />}
          <Text style={[styles.coverPlaceholderText, { color: colors.text }]}>{isUploadingCover ? 'Uploading…' : 'Tap to choose a cover image'}</Text>
        </Pressable>
      )}
      {renderError('coverImage')}

      <View style={styles.fieldHeader}>
        <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Excerpt</Text>
        <Text style={[styles.fieldHint, { color: formData.excerpt.length > MAX_EXCERPT ? '#f59e0b' : colors.mutedText }]}>{formData.excerpt.length}/{MAX_EXCERPT}</Text>
      </View>
      <TextInput
        placeholder="Write a brief, compelling summary to hook readers..."
        placeholderTextColor={colors.mutedText}
        value={formData.excerpt}
        onChangeText={(excerpt) => updateField('excerpt', excerpt)}
        style={[inputStyle, { minHeight: 64 }]}
        multiline
      />
      <Text style={[styles.fieldHint, { color: colors.mutedText, marginTop: 6 }]}>Used in previews and search results</Text>
      {renderError('excerpt')}

      <Text style={[styles.fieldLabel, { color: colors.mutedText, marginTop: 24, marginBottom: 8 }]}>Post Type</Text>
      <View style={styles.row}>
        {(['blog', 'article'] as const).map((postType) => {
          const isSelected = formData.type === postType;
          const TypeIcon = postType === 'blog' ? FileEdit : FileText;
          return (
            <Pressable key={postType} onPress={() => updateField('type', postType)} style={[styles.typeButton, { borderColor: isSelected ? '#10b981' : colors.border, backgroundColor: isSelected ? '#10b981' : colors.surface }]}>
              <TypeIcon size={16} color={isSelected ? '#ffffff' : colors.mutedText} />
              <Text style={[styles.typeButtonText, { color: isSelected ? '#ffffff' : colors.mutedText }]}>{postType === 'blog' ? 'Blog Post' : 'Article'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderContent = () => (
    <View style={styles.stepBody}>
      <View style={styles.fieldHeader}>
        <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>POST CONTENT</Text>
        <View style={styles.row}>
          <FileText size={13} color={colors.mutedText} /><Text style={[styles.fieldHint, { color: colors.mutedText }]}>{wordCount} {wordCount === 1 ? 'word' : 'words'}</Text>
          <Clock size={13} color={colors.mutedText} /><Text style={[styles.fieldHint, { color: colors.mutedText }]}>{readingTime} min read</Text>
        </View>
      </View>
      {renderError('content')}
      {isDraftReady ? (
        <RichTextEditor
          initialHtml={formData.content}
          placeholder="Start writing your amazing story..."
          onChange={(content) => updateField('content', content)}
        />
      ) : null}
    </View>
  );

  const renderClassification = () => (
    <View style={styles.stepBody}>
      <Text style={[styles.fieldLabel, { color: colors.mutedText, marginBottom: 10 }]}>Category</Text>
      <View style={styles.chipWrap}>
        {CATEGORIES.map((category) => {
          const isSelected = formData.categoryId === category.id;
          return (
            <Pressable key={category.id} onPress={() => updateField('categoryId', category.id)} style={[styles.chip, { borderColor: isSelected ? '#10b981' : colors.border, backgroundColor: isSelected ? '#10b981' : colors.surface }]}>
              <Text style={[styles.chipText, { color: isSelected ? '#ffffff' : colors.text }]}>{category.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {renderError('categoryId')}

      <View style={[styles.fieldHeader, { marginTop: 28 }]}>
        <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Tags</Text>
        <Text style={[styles.fieldHint, { color: colors.mutedText }]}>{formData.tags.length}/{MAX_TAGS} max</Text>
      </View>
      <View style={[styles.row, { gap: 8 }]}>
        <View style={[styles.tagInputWrap, { borderColor: colors.border }]}>
          <Hash size={16} color={colors.mutedText} />
          <TextInput
            placeholder="Type a tag"
            placeholderTextColor={colors.mutedText}
            value={tagInput}
            editable={formData.tags.length < MAX_TAGS}
            onChangeText={(text) => text.endsWith(',') ? addTag(text.slice(0, -1)) : setTagInput(text)}
            onSubmitEditing={() => addTag(tagInput)}
            returnKeyType="done"
            style={[styles.tagInput, { color: colors.text }]}
          />
        </View>
        <Pressable onPress={() => addTag(tagInput)} disabled={!tagInput.trim() || formData.tags.length >= MAX_TAGS} style={[styles.smallButton, { backgroundColor: tagInput.trim() && formData.tags.length < MAX_TAGS ? '#10b981' : colors.control }]}>
          <Text style={[styles.smallButtonText, { color: tagInput.trim() && formData.tags.length < MAX_TAGS ? '#ffffff' : colors.mutedText }]}>Add</Text>
        </Pressable>
      </View>
      <View style={[styles.chipWrap, { marginTop: 12 }]}>
        {formData.tags.map((tag) => (
          <Pressable key={tag} onPress={() => removeTag(tag)} style={[styles.chip, { backgroundColor: isDark ? '#064e3b' : '#0f172a', borderColor: 'transparent' }]} accessibilityLabel={`Remove tag ${tag}`}>
            <Text style={[styles.chipText, { color: '#ffffff' }]}>{tag}</Text><X size={13} color="#ffffff" />
          </Pressable>
        ))}
      </View>
      {formData.tags.length < MAX_TAGS ? (
        <>
          <Text style={[styles.fieldLabel, { color: colors.mutedText, marginTop: 18, marginBottom: 8 }]}>Suggested Topics</Text>
          <View style={styles.chipWrap}>
            {POPULAR_TAGS.filter((tag) => !formData.tags.includes(tag)).slice(0, 10).map((tag) => (
              <Pressable key={tag} onPress={() => addTag(tag)} style={[styles.suggestion, { backgroundColor: colors.control }]}>
                <Text style={[styles.suggestionText, { color: colors.secondaryText }]}>+ {tag}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );

  const renderSources = () => (
    <View style={styles.stepBody}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Sources & Citations</Text>
      <Text style={[styles.stepSubtitle, { color: colors.mutedText }]}>Boost your article&apos;s credibility by linking out to the research you used.</Text>
      {formData.sources.length === 0 ? (
        <View style={styles.emptySources}>
          <Link2 size={24} color={colors.mutedText} />
          <Text style={[styles.stepSubtitle, { color: colors.mutedText, textAlign: 'center' }]}>No sources added yet. Citations give your content credibility.</Text>
        </View>
      ) : null}
      {formData.sources.map((source, index) => (
        <View key={index} style={[styles.sourceCard, { borderColor: colors.border }]}>
          <View style={styles.fieldHeader}>
            <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Source #{index + 1}</Text>
            <Pressable onPress={() => updateField('sources', formData.sources.filter((_, position) => position !== index))} accessibilityLabel={`Remove source ${index + 1}`} hitSlop={10}>
              <Trash2 size={16} color={colors.destructive} />
            </Pressable>
          </View>
          <TextInput placeholder="Source title" placeholderTextColor={colors.mutedText} value={source.title} onChangeText={(value) => updateSource(index, 'title', value)} style={inputStyle} />
          <TextInput placeholder="https://" placeholderTextColor={colors.mutedText} value={source.url} onChangeText={(value) => updateSource(index, 'url', value)} style={inputStyle} autoCapitalize="none" keyboardType="url" />
          <TextInput placeholder="Author (optional)" placeholderTextColor={colors.mutedText} value={source.author} onChangeText={(value) => updateSource(index, 'author', value)} style={inputStyle} />
          <Pressable onPress={() => setDatePickerIndex(index)} style={[styles.lineInput, { borderColor: colors.border }]} accessibilityLabel="Choose publish date">
            <Text style={{ color: source.publishDate ? colors.text : colors.mutedText, fontSize: 15 }}>{source.publishDate || 'Publish date (optional)'}</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => updateField('sources', [...formData.sources, { title: '', url: '', author: '', publishDate: '', type: '', citation: '' }])} style={[styles.addSourceButton, { borderColor: colors.border }]}>
        <Plus size={16} color={colors.mutedText} /><Text style={[styles.smallButtonText, { color: colors.mutedText }]}>Add Source</Text>
      </Pressable>
      {datePickerIndex !== null ? (
        <DateTimePicker
          value={formData.sources[datePickerIndex]?.publishDate ? new Date(formData.sources[datePickerIndex].publishDate) : new Date()}
          mode="date"
          maximumDate={new Date()}
          onChange={handleSourceDateChange}
        />
      ) : null}
    </View>
  );

  const reviewWarnings = [
    !formData.coverImage && 'Missing cover image: Your post will look empty on the feed.',
    formData.excerpt.length < 50 && 'Short excerpt: A longer summary hooks readers better.',
    contentText.length < 300 && 'Short content: Your post seems very brief.',
    formData.tags.length === 0 && 'No tags added: Tags help users discover your post.',
    formData.sources.length === 0 && 'No sources cited: Consider adding references for credibility.',
  ].filter((warning): warning is string => Boolean(warning));

  const renderReview = () => (
    <View style={styles.stepBody}>
      {reviewWarnings.length > 0 ? (
        <View style={[styles.warningBox, { backgroundColor: colors.warningSurface }]}>
          <View style={styles.row}><AlertCircle size={16} color={colors.warningText} /><Text style={[styles.warningTitle, { color: colors.warningText }]}>Suggestions before publishing</Text></View>
          {reviewWarnings.map((warning) => <Text key={warning} style={[styles.warningText, { color: colors.warningText }]}>• {warning}</Text>)}
        </View>
      ) : null}

      <Text style={[styles.stepTitle, { color: colors.text }]}>Final Preview</Text>
      <Text style={[styles.stepSubtitle, { color: colors.mutedText }]}>This is how your post will look when published.</Text>
      <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {formData.coverImage ? <Image source={{ uri: formData.coverImage }} style={styles.coverImage} contentFit="cover" /> : null}
        <View style={{ padding: 18, gap: 12 }}>
          <Text style={[styles.previewMeta, { color: '#10b981' }]}>{(CATEGORIES.find((category) => category.id === formData.categoryId)?.label ?? 'Uncategorized').toUpperCase()} · {readingTime} MIN READ · {formData.type.toUpperCase()}</Text>
          <Text style={[styles.previewTitle, { color: colors.text }]}>{formData.title || 'Untitled Post'}</Text>
          {formData.excerpt ? <Text style={[styles.previewExcerpt, { color: colors.mutedText, borderColor: '#10b981' }]}>{formData.excerpt}</Text> : null}
          {contentText ? <RichBlogContent content={formData.content} /> : <Text style={[styles.previewBody, { color: colors.mutedText }]}>No content written yet.</Text>}
          {formData.tags.length > 0 ? <View style={styles.chipWrap}>{formData.tags.map((tag) => <Text key={tag} style={[styles.previewTag, { backgroundColor: colors.control, color: colors.secondaryText }]}>#{tag}</Text>)}</View> : null}
        </View>
      </View>

      <View style={[styles.disclaimerBox, { backgroundColor: colors.warningSurface, borderColor: isDark ? '#78350f' : '#fde68a' }]}>
        <View style={[styles.row, { alignItems: 'flex-start' }]}>
          <Shield size={20} color={colors.warningText} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.warningTitle, { color: colors.warningText }]}>AUTHOR PUBLISHING DISCLAIMER ({AUTHOR_DISCLAIMER_VERSION})</Text>
            <Text style={[styles.warningText, { color: colors.warningText }]}>
              I confirm that I created this content or have permission to publish it, that sources and quotations are appropriately attributed, and that sponsored or AI-assisted material is disclosed. I accept responsibility for this content. Identity verification confirms account identity only and does not mean Ourlime endorses the author or guarantees accuracy.
            </Text>
          </View>
        </View>
        <Pressable onPress={() => setDisclaimerAccepted((accepted) => !accepted)} style={[styles.row, styles.disclaimerCheckRow]} accessibilityRole="checkbox" accessibilityState={{ checked: disclaimerAccepted }}>
          <View style={[styles.checkbox, { borderColor: disclaimerAccepted ? '#10b981' : colors.mutedText, backgroundColor: disclaimerAccepted ? '#10b981' : 'transparent' }]}>
            {disclaimerAccepted ? <Check size={14} color="#ffffff" strokeWidth={3} /> : null}
          </View>
          <Text style={[styles.disclaimerAgreeText, { color: colors.text }]}>I have read and agree to the Author Publishing Disclaimer, Content Policy, Community Guidelines, Copyright Policy, Privacy Policy, and Terms of Use.</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0: return renderBasics();
      case 1: return renderContent();
      case 2: return renderClassification();
      case 3: return renderSources();
      default: return renderReview();
    }
  };

  const isLastStep = currentStep === STEPS.length - 1;
  const primaryDisabled = isLastStep ? !disclaimerAccepted || isBusy : !canProceed(currentStep);

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!isBusy) onClose(); }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable onPress={onClose} disabled={isBusy} style={styles.headerIcon} accessibilityLabel="Close editor">
            <X size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{editBlogId ? 'Edit Post' : 'Create Post'}</Text>
          <View style={[styles.autosavePill, { backgroundColor: colors.control }]}>
            {autosaveStatus === 'saved' ? <CheckCircle size={12} color="#10b981" /> : <Save size={12} color={colors.mutedText} />}
            <Text style={[styles.autosaveText, { color: autosaveStatus === 'saved' ? '#10b981' : colors.mutedText }]}>{autosaveStatus === 'saving' ? 'Saving…' : autosaveStatus === 'saved' ? 'Saved' : 'Draft'}</Text>
          </View>
        </View>
        {renderStepProgress()}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {renderStep()}
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {currentStep > 0 ? (
              <Pressable onPress={handleBack} style={[styles.footerButton, { backgroundColor: colors.control }]}>
                <ArrowLeft size={18} color={colors.text} /><Text style={[styles.footerButtonText, { color: colors.text }]}>Back</Text>
              </Pressable>
            ) : <View />}
            <View style={styles.row}>
              <Pressable onPress={() => void handleSubmit('draft')} disabled={isBusy} style={styles.footerGhostButton} accessibilityLabel="Save draft">
                {submittingStatus === 'draft' ? <ActivityIndicator size="small" color={colors.mutedText} /> : <Save size={18} color={colors.mutedText} />}
              </Pressable>
              <Pressable
                onPress={() => isLastStep ? void handleSubmit('published') : handleNext()}
                disabled={primaryDisabled}
                style={[styles.footerButton, { backgroundColor: '#10b981', opacity: primaryDisabled ? 0.5 : 1 }]}
              >
                {submittingStatus === 'published' ? <ActivityIndicator size="small" color="#ffffff" /> : isLastStep ? <Sparkles size={18} color="#ffffff" /> : null}
                <Text style={[styles.footerButtonText, { color: '#ffffff' }]}>{isLastStep ? (editBlogId ? 'Update Post' : 'Publish Now') : 'Next Step'}</Text>
                {!isLastStep ? <ArrowRight size={18} color="#ffffff" /> : null}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <CustomModal
        visible={notice !== null}
        type={notice?.type ?? 'info'}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        confirmText="OK"
        onConfirm={handleNoticeClose}
        onClose={handleNoticeClose}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  headerIcon: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800' },
  autosavePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  autosaveText: { fontSize: 12, fontWeight: '600' },
  progressWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  progressBar: { height: 3, backgroundColor: '#10b981' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 10 },
  progressStep: { alignItems: 'center', gap: 4, flex: 1 },
  progressDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  progressLabel: { fontSize: 11, fontWeight: '700' },
  scrollContent: { padding: 18, paddingBottom: 40 },
  stepBody: { gap: 4 },
  stepTitle: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  stepSubtitle: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  titleInput: { fontSize: 26, fontWeight: '800', borderBottomWidth: 1, paddingBottom: 8 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  fieldHint: { fontSize: 12 },
  errorText: { fontSize: 12, marginTop: 6 },
  lineInput: { fontSize: 15, borderBottomWidth: 1, paddingVertical: 10 },
  coverFrame: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  coverImage: { width: '100%', aspectRatio: 16 / 9 },
  coverActions: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 8 },
  coverActionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  coverActionText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  coverPlaceholder: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 36 },
  coverPlaceholderText: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 12 },
  typeButtonText: { fontSize: 14, fontWeight: '700' },
  contentInput: { minHeight: 360, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16, lineHeight: 24 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },
  tagInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1 },
  tagInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  smallButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  smallButtonText: { fontSize: 14, fontWeight: '700' },
  suggestion: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  suggestionText: { fontSize: 12, fontWeight: '600' },
  emptySources: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  sourceCard: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 14, marginBottom: 6 },
  addSourceButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 16, marginTop: 12 },
  warningBox: { borderRadius: 14, padding: 14, gap: 6, marginBottom: 12 },
  warningTitle: { fontSize: 13, fontWeight: '800' },
  warningText: { fontSize: 12, lineHeight: 18 },
  previewCard: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  previewMeta: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  previewTitle: { fontSize: 26, fontWeight: '900', lineHeight: 32 },
  previewExcerpt: { fontSize: 16, fontStyle: 'italic', borderLeftWidth: 3, paddingLeft: 12, lineHeight: 23 },
  previewBody: { fontSize: 15, lineHeight: 23 },
  previewTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, fontSize: 13, fontWeight: '600', overflow: 'hidden' },
  disclaimerBox: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14, marginTop: 20 },
  disclaimerCheckRow: { alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  disclaimerAgreeText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  footerButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12 },
  footerButtonText: { fontSize: 15, fontWeight: '800' },
  footerGhostButton: { padding: 12, marginRight: 4 },
});
