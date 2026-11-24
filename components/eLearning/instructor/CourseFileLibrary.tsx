import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Eye, FileText, Film, Image as ImageIcon, Search, Trash2, Upload } from 'lucide-react-native';
import { ELearningChip, StatusPill } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { COURSE_FILE_FILTERS, formatCourseFileSize } from '@/lib/helpers/courseFiles';
import type { CourseFileKind, CourseLibraryFile } from '@/lib/types/instructor';

type CourseFileLibraryProps = {
  files: CourseLibraryFile[];
  error: string | null;
  onAddMedia: () => void;
  onAddDocuments: () => void;
  onPreview: (file: CourseLibraryFile) => void;
  onRemove: (file: CourseLibraryFile) => void;
};

const KIND_ICON: Record<CourseFileKind, typeof FileText> = { video: Film, image: ImageIcon, pdf: FileText, document: FileText };
const KIND_LABEL: Record<CourseFileKind, string> = { video: 'Video', image: 'Image', pdf: 'PDF', document: 'Document' };
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

/** The website's Content step: upload videos, PDFs, images and documents, then search, filter, preview or remove them. */
export default function CourseFileLibrary({ files, error, onAddMedia, onAddDocuments, onPreview, onRemove }: CourseFileLibraryProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CourseFileKind | 'all'>('all');
  const term = search.trim().toLowerCase();
  const visible = files.filter((file) => file.name.toLowerCase().includes(term) && (filter === 'all' || file.kind === filter));
  const uploadingCount = files.filter((file) => file.status === 'uploading').length;

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>Upload files</Text>
        <View style={styles.uploadRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Upload videos and images from your gallery" onPress={onAddMedia} android_ripple={RIPPLE} style={styles.uploadButton}>
            <Upload size={22} color={colors.accentText} />
            <Text style={styles.uploadTitle}>Videos & images</Text>
            <Text style={styles.uploadHint}>From your gallery</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Upload PDF or Word documents" onPress={onAddDocuments} android_ripple={RIPPLE} style={styles.uploadButton}>
            <FileText size={22} color={colors.accentText} />
            <Text style={styles.uploadTitle}>Documents</Text>
            <Text style={styles.uploadHint}>PDF or Word</Text>
          </Pressable>
        </View>
        <Text style={styles.limit}>Up to 50 MB per file. Videos play best as MP4 (H.264/AAC).</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.headingRow}>
          <Text accessibilityRole="header" style={[styles.heading, styles.flex]}>Your library</Text>
          <Text style={styles.muted}>{files.length} {files.length === 1 ? 'file' : 'files'}{uploadingCount > 0 ? ` · ${uploadingCount} uploading` : ''}</Text>
        </View>
        {files.length > 0 ? (
          <>
            <View style={styles.searchBox}>
              <Search size={18} color={colors.mutedText} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search files" placeholderTextColor={colors.mutedText} accessibilityLabel="Search files" returnKeyType="search" style={styles.searchInput} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filters}>
              {COURSE_FILE_FILTERS.map((option) => <ELearningChip key={option.value} label={option.label} isSelected={filter === option.value} onPress={() => setFilter(option.value)} />)}
            </ScrollView>
          </>
        ) : null}
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{files.length === 0 ? 'No files yet' : 'No files match'}</Text>
            <Text style={styles.muted}>{files.length === 0 ? 'Files you upload appear here, ready to attach to lessons.' : 'Try another search or filter.'}</Text>
          </View>
        ) : visible.map((file) => {
          const Icon = KIND_ICON[file.kind];
          return (
            <View key={file.id} style={styles.fileRow}>
              <View style={styles.fileIcon}><Icon size={18} color={colors.accentText} /></View>
              <View style={styles.flex}>
                <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.muted}>{KIND_LABEL[file.kind]} · {formatCourseFileSize(file.size)}</Text>
                  {file.status === 'ready' ? null : <StatusPill label={file.status === 'uploading' ? 'Uploading…' : 'Upload failed'} tone={file.status === 'uploading' ? 'neutral' : 'danger'} />}
                </View>
              </View>
              {file.status === 'ready' ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Preview ${file.name}`} onPress={() => onPreview(file)} android_ripple={RIPPLE} style={styles.rowButton}>
                  <Eye size={18} color={colors.icon} />
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} onPress={() => onRemove(file)} android_ripple={RIPPLE} style={styles.rowButton}>
                <Trash2 size={18} color={colors.mutedText} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  card: { padding: 16, gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  heading: { color: colors.text, fontSize: 17, fontWeight: '800' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  uploadRow: { flexDirection: 'row', gap: 10 },
  uploadButton: { flex: 1, minWidth: 0, minHeight: 104, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.canvas, overflow: 'hidden' },
  uploadTitle: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  uploadHint: { color: colors.mutedText, fontSize: 12, textAlign: 'center' },
  limit: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  error: { color: colors.destructiveText, fontSize: 13, fontWeight: '600' },
  searchBox: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 8 },
  filters: { gap: 8, paddingVertical: 2 },
  empty: { paddingVertical: 20, paddingHorizontal: 12, gap: 4, alignItems: 'center', borderRadius: 12, backgroundColor: colors.canvas },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  fileRow: { minHeight: 60, paddingLeft: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
  fileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  metaRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
