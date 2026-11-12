import { useMemo } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ExternalLink, FileText, X } from 'lucide-react-native';
import CustomVideoPlayer from '@/components/media/CustomVideoPlayer';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { CourseLibraryFile } from '@/lib/types/instructor';
import { formatCourseFileSize } from '@/lib/helpers/courseFiles';

type CourseFilePreviewProps = {
  file: CourseLibraryFile | null;
  onClose: () => void;
};

/** Full-screen preview of an uploaded course file (the website's library preview): images and videos in the app, documents opened outside. */
export default function CourseFilePreview({ file, onClose }: CourseFilePreviewProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const url = file?.url ?? '';

  const handleOpen = () => {
    if (!url) return;
    void Linking.openURL(url).catch((openError: unknown) => {
      console.warn('[CourseFilePreview.handleOpen] Error:', openError instanceof Error ? openError.message : 'Unknown error');
    });
  };

  return (
    <Modal visible={Boolean(file && url)} animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close preview" hitSlop={8} onPress={onClose} style={styles.iconButton}>
            <X size={22} color={colors.text} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.title} numberOfLines={1}>{file?.name ?? 'Preview'}</Text>
            {file ? <Text style={styles.meta}>{file.kind.toUpperCase()} • {formatCourseFileSize(file.size)}</Text> : null}
          </View>
          <Pressable accessibilityRole="link" accessibilityLabel="Open the original file" onPress={handleOpen} style={styles.openButton}>
            <ExternalLink size={16} color={colors.text} />
            <Text style={styles.openText}>Open</Text>
          </Pressable>
        </View>
        <View style={styles.stage}>
          {file?.kind === 'image' ? <Image source={{ uri: url }} contentFit="contain" style={styles.media} accessibilityLabel={`Preview of ${file.name}`} /> : null}
          {file?.kind === 'video' ? <CustomVideoPlayer url={url} autoPlay contentFit="contain" /> : null}
          {file && (file.kind === 'pdf' || file.kind === 'document') ? (
            <View style={styles.documentNote}>
              <FileText size={40} color={colors.mutedText} />
              <Text style={styles.noteTitle}>This file can't be previewed in the app.</Text>
              <Text style={styles.noteText}>Use Open to view or download the original file.</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  header: { minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  meta: { color: colors.mutedText, fontSize: 12 },
  openButton: { minHeight: 38, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  openText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  stage: { flex: 1, justifyContent: 'center', backgroundColor: colors.control },
  media: { width: '100%', height: '100%' },
  documentNote: { alignItems: 'center', gap: 8, padding: 28 },
  noteTitle: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  noteText: { color: colors.mutedText, fontSize: 14, textAlign: 'center' },
});
