import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ExternalLink, FileText } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { CourseResource } from '@/lib/types/course';
import { formatFileSize, openExternalLink } from './workspaceHelpers';

type ModuleResourcesProps = {
  resources: CourseResource[];
  /** Called when a link cannot be opened on this device. */
  onOpenError?: () => void;
};

/** A module's resources (courseResources) as tappable links, like the "Resources" strip on the website's modules page. */
export default function ModuleResources({ resources, onOpenError }: ModuleResourcesProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (resources.length === 0) return null;

  const handleOpen = async (resource: CourseResource) => {
    const opened = await openExternalLink(resource.url);
    if (!opened) onOpenError?.();
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Resources</Text>
      {resources.map((resource) => (
        <Pressable key={resource.id} accessibilityRole="link" accessibilityLabel={`Open ${resource.title}`} onPress={() => void handleOpen(resource)} style={styles.row}>
          <FileText size={16} color={colors.accentText} />
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={2}>{resource.title}</Text>
            {resource.format || resource.size ? (
              <Text style={styles.meta}>{[resource.format?.toUpperCase(), resource.size ? formatFileSize(resource.size) : undefined].filter(Boolean).join(' · ')}</Text>
            ) : null}
          </View>
          <ExternalLink size={15} color={colors.mutedText} />
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 6, paddingVertical: 8 },
  label: { color: colors.mutedText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas },
  copy: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 13, fontWeight: '700' },
  meta: { color: colors.mutedText, fontSize: 11 },
});
