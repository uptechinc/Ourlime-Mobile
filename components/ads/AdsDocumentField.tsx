import { Text, TouchableOpacity, View } from 'react-native';
import { FileText, X } from 'lucide-react-native';
import { ADS_GREEN, AdsUploadTile } from '@/components/ads/AdsUi';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type AdsDocumentFieldProps = {
  label: string;
  required?: boolean;
  description?: string;
  uploadLabel: string;
  fileName: string | null;
  isUploaded: boolean;
  isUploading: boolean;
  disabled?: boolean;
  onPick: () => void;
  onRemove: () => void;
};

/** One verification document: an upload tile, or the uploaded file with a remove button (the website's DocumentUploadField). */
export default function AdsDocumentField({ label, required = false, description, uploadLabel, fileName, isUploaded, isUploading, disabled = false, onPick, onRemove }: AdsDocumentFieldProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.secondaryText }}>
        {label}
        {required ? <Text style={{ color: colors.destructive }}> *</Text> : <Text style={{ fontWeight: '400', color: colors.mutedText }}> (optional)</Text>}
      </Text>
      {description ? <Text style={{ fontSize: 12, color: colors.mutedText }}>{description}</Text> : null}
      {isUploaded ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.successSurface, alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={16} color={ADS_GREEN} />
          </View>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: colors.text }}>{fileName || 'Document uploaded'}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove document" hitSlop={8} onPress={onRemove}>
            <X size={18} color={colors.mutedText} />
          </TouchableOpacity>
        </View>
      ) : (
        <AdsUploadTile label={isUploading ? 'Uploading…' : uploadLabel} helper="PDF, JPG or PNG, up to 10 MB" disabled={isUploading || disabled} onPress={onPick} />
      )}
    </View>
  );
}
