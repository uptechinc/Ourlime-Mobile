import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import {
  mobileExportService,
  type MobileExportColumn,
} from '@/lib/services/MobileExportService';

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
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: 'excel' | 'csv' | 'doc') => {
    if (data.length === 0) return;
    setExporting(format);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fullFilename = `${filename}-${dateStr}`;

    try {
      if (format === 'excel') {
        await mobileExportService.exportToExcel(fullFilename, sheetName, columns, data);
      } else if (format === 'csv') {
        await mobileExportService.exportToCsv(fullFilename, columns, data);
      } else if (format === 'doc') {
        await mobileExportService.exportToDocument(fullFilename, title, periodLabel, columns, data);
      }
    } catch (err) {
      console.error('[MobileAdminExportModal] Error exporting:', err);
    } finally {
      setExporting(null);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <TouchableWithoutFeedback>
            <View
              style={{
                width: '100%',
                maxWidth: 360,
                backgroundColor: colors.surface,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 20,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                    Export Data
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 2 }}>
                    {data.length} records • {periodLabel}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={colors.mutedText} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 10 }}>
                {/* Excel Option */}
                <TouchableOpacity
                  onPress={() => void handleExport('excel')}
                  disabled={exporting !== null}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: colors.canvas,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: '#10b98120',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="grid" size={18} color="#10b981" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        Excel Spreadsheet
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.mutedText }}>
                        Standard .xlsx format
                      </Text>
                    </View>
                  </View>
                  {exporting === 'excel' ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Icon name="download" size={16} color={colors.mutedText} />
                  )}
                </TouchableOpacity>

                {/* CSV Option */}
                <TouchableOpacity
                  onPress={() => void handleExport('csv')}
                  disabled={exporting !== null}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: colors.canvas,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: '#3b82f620',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="file-text" size={18} color="#3b82f6" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        CSV File
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.mutedText }}>
                        Comma-separated values (.csv)
                      </Text>
                    </View>
                  </View>
                  {exporting === 'csv' ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Icon name="download" size={16} color={colors.mutedText} />
                  )}
                </TouchableOpacity>

                {/* Document Report Option */}
                <TouchableOpacity
                  onPress={() => void handleExport('doc')}
                  disabled={exporting !== null}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: colors.canvas,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: '#f43f5e20',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="file" size={18} color="#f43f5e" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        Document Report
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.mutedText }}>
                        Formatted text/audit summary
                      </Text>
                    </View>
                  </View>
                  {exporting === 'doc' ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Icon name="download" size={16} color={colors.mutedText} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
