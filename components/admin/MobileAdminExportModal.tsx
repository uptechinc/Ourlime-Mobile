import { useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { toast } from 'sonner-native';
import AdminIconButton from '@/components/admin/AdminIconButton';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { getAdminTone, radius, space, type, type AdminIconName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { mobileExportService, type MobileExportColumn } from '@/lib/services/MobileExportService';

type MobileAdminExportModalProps = {
  visible: boolean;
  onClose: () => void;
  filename: string;
  title: string;
  columns: MobileExportColumn[];
  data: Record<string, unknown>[];
  periodLabel: string;
  sheetName?: string;
};

type ExportFormat = 'excel' | 'csv' | 'doc';

const EXPORT_OPTIONS: { format: ExportFormat; label: string; description: string; icon: AdminIconName }[] = [
  { format: 'excel', label: 'Excel spreadsheet', description: 'Standard .xlsx format', icon: 'grid' },
  { format: 'csv', label: 'CSV file', description: 'Comma-separated values (.csv)', icon: 'file-text' },
  { format: 'doc', label: 'Document report', description: 'Formatted text audit summary', icon: 'file' },
];

/** Admin export sheet: three format rows in an overflow-style bottom sheet. Stays open on error so the admin can retry. */
export default function MobileAdminExportModal({
  visible,
  onClose,
  filename,
  title,
  columns,
  data,
  periodLabel,
  sheetName = 'Data',
}: MobileAdminExportModalProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const pending = getAdminTone(colors, 'pending');
  const isEmpty = data.length === 0;

  const handleClose = () => {
    if (exporting) return;
    onClose();
  };

  const handleExport = async (format: ExportFormat) => {
    if (exporting) return;
    if (data.length === 0) {
      toast.error('There are no records to export for this range.');
      return;
    }
    setExporting(format);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fullFilename = `${filename}-${dateStr}`;

    try {
      if (format === 'excel') {
        await mobileExportService.exportToExcel(fullFilename, sheetName, columns, data);
      } else if (format === 'csv') {
        await mobileExportService.exportToCsv(fullFilename, columns, data);
      } else {
        await mobileExportService.exportToDocument(fullFilename, title, periodLabel, columns, data);
      }
      toast.success(`Exported ${data.length} record${data.length === 1 ? '' : 's'}.`);
      onClose();
    } catch (err) {
      // Keep the sheet open so the admin can retry or pick another format.
      console.error('[MobileAdminExportModal.handleExport] Error:', err);
      toast.error(err instanceof Error && err.message ? err.message : 'The export could not be created.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      {/* Same Android full-screen workaround as FilterSheet, so the sheet sits on the bottom edge. */}
      <View style={{ height: Dimensions.get('screen').height, justifyContent: 'flex-end' }}>
        {/* The backdrop is a sibling behind the sheet, so taps inside the sheet never reach it. */}
        <ModalBackdrop onPress={handleClose} accessibilityLabel="Close export" style={[StyleSheet.absoluteFill, { backgroundColor: colors.modalScrim }]} />
        <ModalMotionSurface variant="sheet" style={{ maxHeight: '80%' }}>
          <SwipeDismissSurface
            visible={visible}
            onDismiss={handleClose}
            disabled={exporting !== null}
            handleColor={colors.border}
            accessibilityLabel="Swipe down to close export"
            style={{
              borderTopLeftRadius: radius.dialog,
              borderTopRightRadius: radius.dialog,
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, space.md) + space.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: space.xl, paddingRight: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: colors.text }]}>Export data</Text>
                <Text style={[type.meta, { color: colors.mutedText }]}>
                  {data.length} record{data.length === 1 ? '' : 's'} · {periodLabel}
                </Text>
              </View>
              <AdminIconButton icon="x" label="Close export" disabled={exporting !== null} onPress={handleClose} />
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md }} showsVerticalScrollIndicator={false}>
              {isEmpty ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    marginHorizontal: space.md,
                    marginBottom: space.sm,
                    padding: space.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: pending.border,
                    backgroundColor: pending.soft,
                  }}
                >
                  <Icon name="info" size={16} color={pending.text} />
                  <Text style={[type.body, { flex: 1, color: pending.text }]}>There are no records in this range. Change the filters to export.</Text>
                </View>
              ) : null}
              {EXPORT_OPTIONS.map((option) => {
                const isBusy = exporting === option.format;
                const isLocked = exporting !== null && !isBusy;
                return (
                  <Pressable
                    key={option.format}
                    onPress={() => void handleExport(option.format)}
                    disabled={exporting !== null}
                    accessibilityRole="menuitem"
                    accessibilityLabel={option.label}
                    accessibilityHint={option.description}
                    accessibilityState={{ disabled: isEmpty || exporting !== null, busy: isBusy }}
                    style={({ pressed }) => ({
                      minHeight: 52,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.md,
                      paddingHorizontal: space.md,
                      paddingVertical: space.sm,
                      borderRadius: radius.md,
                      backgroundColor: pressed ? colors.control : 'transparent',
                      opacity: isEmpty || isLocked ? 0.5 : 1,
                    })}
                  >
                    <Icon name={option.icon} size={18} color={colors.icon} />
                    <View style={{ flex: 1 }}>
                      <Text style={[type.bodyStrong, { color: colors.text }]}>{option.label}</Text>
                      <Text style={[type.meta, { color: colors.mutedText }]}>{option.description}</Text>
                    </View>
                    {isBusy ? <ActivityIndicator size="small" color={colors.icon} /> : <Icon name="download" size={16} color={colors.mutedText} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </SwipeDismissSurface>
        </ModalMotionSurface>
      </View>
    </Modal>
  );
}
