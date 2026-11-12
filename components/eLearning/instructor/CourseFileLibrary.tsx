import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FileText, Film, Image as ImageIcon, Search, Trash2, Upload } from 'lucide-react-native';
import { Skeleton } from '@/components/ui/Skeleton';
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

/** The website's Content step: upload videos, PDFs, images and documents, then search, filter, preview or remove them. */
export default function CourseFileLibrary({ files, error, onAddMedia, onAddDocuments, onPreview, onRemove }: CourseFileLibraryProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CourseFileKind | 'all'>('all');
  const term = search.trim().toLowerCase();
  const visible = files.filter((file) => file.name.toLowerCase().includes(term) && (filter === 'all' || file.kind === filter));

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.heading}>Upload</Text>
        <Text style={styles.muted}>Videos, PDFs, images and documents for your lessons.</Text>
        <View style={styles.uploadRow}>
          <Pressable accessibilityRole="button" onPress={onAddMedia} style={styles.uploadButton}>
            <Upload size={20} color={colors.mutedText} />
            <Text style={styles.uploadTitle}>Videos & images</Text>
            <Text style={styles.uploadHint}>From your gallery</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onAddDocuments} style={styles.uploadButton}>
            <FileText size={20} color={colors.mutedText} />
            <Text style={styles.uploadTitle}>Documents</Text>
            <Text style={styles.uploadHint}>PDF or Word</Text>
          </Pressable>
        </View>
        <Text style={styles.limit}>Up to 50 MB per file • MP4 (H.264/AAC) for videos</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Library</Text>
        <View style={styles.searchBox}>
          <Search size={16} color={colors.mutedText} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search files" placeholderTextColor={colors.mutedText} accessibilityLabel="Search files" style={styles.searchInput} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {COURSE_FILE_FILTERS.map((option) => {
            const isActive = filter === option.value;
            return (
              <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: isActive }} onPress={() => setFilter(option.value)} style={[styles.filterChip, isActive && styles.filterChipActive]}>
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {visible.length === 0 ? (
          <View style={styles.empty}><Text style={styles.muted}>{files.length === 0 ? 'No files uploaded yet' : 'No files match your search'}</Text></View>
        ) : visible.map((file) => {
          const Icon = KIND_ICON[file.kind];
          return (
            <View key={file.id} style={styles.fileRow}>
              <Icon size={18} color={colors.accentText} />
              <View style={styles.flex}>
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.muted}>{file.kind.toUpperCase()} • {formatCourseFileSize(file.size)} • </Text>
                  {file.status === 'uploading' ? <Skeleton width={56} height={10} borderRadius={5} /> : (
                    <Text style={file.status === 'ready' ? styles.ready : styles.error}>{file.status === 'ready' ? 'Ready' : 'Error'}</Text>
                  )}
                </View>
              </View>
              {file.status === 'ready' ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Preview ${file.name}`} onPress={() => onPreview(file)} style={styles.previewButton}>
                  <Text style={styles.previewText}>Preview</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove file ${file.name}`} hitSlop={6} onPress={() => onRemove(file)} style={styles.removeButton}>
                <Trash2 size={17} color={colors.mutedText} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 12 },
  flex: { flex: 1 },
  card: { padding: 14, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  heading: { color: colors.text, fontSize: 17, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 12 },
  uploadRow: { flexDirection: 'row', gap: 10 },
  uploadButton: { flex: 1, minHeight: 96, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.canvas },
  uploadTitle: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  uploadHint: { color: colors.mutedText, fontSize: 12, textAlign: 'center' },
  limit: { color: colors.mutedText, fontSize: 11, textAlign: 'center' },
  error: { color: colors.destructiveText, fontSize: 12, fontWeight: '700' },
  ready: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  searchBox: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 8 },
  filters: { gap: 8 },
  filterChip: { minHeight: 34, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  filterText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: colors.onAccent },
  empty: { paddingVertical: 24, alignItems: 'center', borderRadius: 12, backgroundColor: colors.canvas },
  fileRow: { minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  metaRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  previewButton: { minHeight: 34, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  previewText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  removeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
