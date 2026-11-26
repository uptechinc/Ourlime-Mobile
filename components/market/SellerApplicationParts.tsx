import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/** Darker emerald under white text (5.5:1) in both themes; the theme accent is too light for a filled button. */
const PRIMARY_FILL = '#047857';

type SmallButtonProps = { label: string; icon?: string; tone?: 'neutral' | 'danger' | 'primary'; disabled?: boolean; onPress: () => void; accessibilityLabel?: string };

/** Outlined secondary action (Add, Replace), or solid `primary` for the one next step inside a row (Retry upload). */
export function SellerSmallButton({ label, icon, tone = 'neutral', disabled, onPress, accessibilityLabel }: SmallButtonProps) {
  const { colors } = useAppTheme();
  const color = tone === 'danger' ? colors.destructive : tone === 'primary' ? '#ffffff' : colors.accentText;
  const borderColor = tone === 'danger' ? colors.destructiveBorder : tone === 'primary' ? PRIMARY_FILL : colors.successBorder;
  const backgroundColor = tone === 'danger' ? colors.destructiveSurface : tone === 'primary' ? PRIMARY_FILL : colors.successSurface;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} disabled={disabled} onPress={onPress}
    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor, backgroundColor, opacity: disabled ? 0.5 : 1 }}>
    {icon ? <Icon name={icon} size={15} color={color} /> : null}
    <Text style={{ color, fontWeight: '700', fontSize: 14 }}>{label}</Text>
  </TouchableOpacity>;
}

/** One document's upload, shown inside its own row. `processing`: the bytes are up and the server is checking the file. */
export type SellerUploadState = { phase: 'uploading' | 'processing' | 'done' | 'failed'; percent: number; fileName: string; message?: string };

type DocumentRowProps = {
  label: string;
  hint: string;
  required: boolean;
  isImage: boolean;
  fileName: string | null;
  /** An upload saved on this device that did not finish (from an earlier visit or a failed attempt): Retry resends it. */
  pendingName: string | null;
  upload: SellerUploadState | null;
  error?: string;
  disabled: boolean;
  onChoose: () => void;
  onRemove: () => void;
  /** Sends the saved file again. */
  onRetry: () => void;
  onDiscard: () => void;
};

/**
 * One document as a single row: what it is, whether it is added, and one Add/Replace action. While its file uploads
 * the row shows the progress itself (bar, percent, then "Checking the file"), a short "Uploaded" confirmation when
 * done, and on failure the reason with Retry right there. Other rows stay usable meanwhile.
 */
export function SellerDocumentRow({ label, hint, required, isImage, fileName, pendingName, upload, error, disabled, onChoose, onRemove, onRetry, onDiscard }: DocumentRowProps) {
  const { colors } = useAppTheme();
  const isAdded = Boolean(fileName);
  const isWorking = upload?.phase === 'uploading' || upload?.phase === 'processing';
  const isDone = upload?.phase === 'done';
  const isFailed = upload?.phase === 'failed';
  // A file from an earlier visit that never finished: not an error yet, just not uploaded.
  const leftoverName = !upload ? pendingName : null;
  const hasPanel = isFailed || Boolean(leftoverName);
  // Retry needs the device copy of this same file; a file rejected before copying can only be replaced.
  const canRetry = Boolean(pendingName) && (!upload || upload.fileName === pendingName);
  const borderColor = isFailed ? colors.destructiveBorder : leftoverName ? colors.warningBorder : error ? colors.destructive : isWorking ? colors.accent : isAdded ? colors.successBorder : colors.border;
  const subtitle = isWorking ? upload.fileName : fileName ?? hint;
  const panel = isFailed
    ? { surface: colors.destructiveSurface, text: colors.destructiveText, icon: 'alert-circle', heading: 'Upload failed', body: upload?.message ? `${upload.fileName}: ${upload.message}` : upload?.fileName ?? '' }
    : { surface: colors.warningSurface, text: colors.warningText, icon: 'upload-cloud', heading: `Not uploaded yet: ${leftoverName ?? ''}`, body: '' };
  return <View style={{ gap: 10, padding: isWorking ? 13 : 14, borderRadius: 14, borderWidth: isWorking ? 2 : 1, borderColor, backgroundColor: colors.surface }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isAdded && !isWorking ? colors.successSurface : colors.control }}>
        {isWorking ? <ActivityIndicator size="small" color={colors.accentText} />
          : <Icon name={isAdded ? 'check' : isImage ? 'image' : 'file-text'} size={20} color={isAdded ? colors.successText : colors.icon} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{label}</Text>
          <Text style={{ color: required ? colors.warningText : colors.mutedText, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{required ? 'Required' : 'Optional'}</Text>
        </View>
        <Text numberOfLines={1} style={{ color: isAdded && !isWorking ? colors.successText : colors.mutedText, fontSize: 13 }}>{subtitle}</Text>
      </View>
      {/* While working, failed or left over, the row's own panel holds the actions, so there is one obvious next step. */}
      {isWorking || hasPanel ? null : <SellerSmallButton label={isAdded ? 'Replace' : 'Add'} icon={isAdded ? 'refresh-cw' : 'upload'} disabled={disabled} onPress={onChoose} accessibilityLabel={`${isAdded ? 'Replace' : 'Add'} ${label}`} />}
    </View>
    {isWorking ? <SellerUploadProgress label={label} upload={upload} /> : null}
    {isDone ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name="check-circle" size={15} color={colors.successText} />
      <Text style={{ color: colors.successText, fontSize: 13, fontWeight: '700' }}>Uploaded</Text>
    </View> : null}
    {hasPanel ? <View accessibilityLiveRegion="polite" style={{ gap: 10, padding: 12, borderRadius: 10, backgroundColor: panel.surface }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Icon name={panel.icon} size={16} color={panel.text} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole={isFailed ? 'alert' : 'text'} numberOfLines={2} style={{ color: panel.text, fontSize: 14, fontWeight: '700' }}>{panel.heading}</Text>
          {panel.body ? <Text style={{ color: panel.text, fontSize: 13 }}>{panel.body}</Text> : null}
          {isAdded ? <Text style={{ color: colors.secondaryText, fontSize: 13 }}>Your earlier file is still attached.</Text> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* A file rejected before it was copied (wrong type, too large) cannot be resent: only choosing another helps. */}
        {canRetry ? <SellerSmallButton label="Retry upload" icon="rotate-cw" tone="primary" disabled={disabled} onPress={onRetry} accessibilityLabel={`Retry uploading ${label}`} /> : null}
        <SellerSmallButton label="Choose another file" icon="upload" disabled={disabled} onPress={onChoose} accessibilityLabel={`Choose another file for ${label}`} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={canRetry ? `Discard the unfinished ${label} upload` : `Dismiss the ${label} upload error`} disabled={disabled} onPress={onDiscard}
          style={{ minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' }}>
          <Text style={{ color: colors.mutedText, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' }}>{canRetry ? 'Discard' : 'Dismiss'}</Text>
        </TouchableOpacity>
      </View>
    </View> : null}
    {isAdded && !isWorking && !hasPanel ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${label}`} disabled={disabled} onPress={onRemove} style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
      <Text style={{ color: colors.destructive, fontSize: 13, fontWeight: '600' }}>Remove file</Text>
    </TouchableOpacity> : null}
    {error && !isWorking ? <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text> : null}
  </View>;
}

type UploadProgressProps = { label: string; upload: SellerUploadState };

/** Progress bar with words under it: "Uploading · 42%", then "Checking the file privately" once the bytes are up. */
function SellerUploadProgress({ label, upload }: UploadProgressProps) {
  const { colors } = useAppTheme();
  const isProcessing = upload.phase === 'processing';
  const percent = Math.max(0, Math.min(100, upload.percent));
  const words = isProcessing ? 'Checking the file privately…' : percent === 0 ? 'Starting upload…' : `Uploading · ${percent}%`;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`${label} upload`} accessibilityValue={isProcessing ? { text: words } : { min: 0, max: 100, now: percent }} style={{ gap: 6 }}>
    <View style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.control }}>
      <View style={{ width: `${isProcessing ? 100 : Math.max(4, percent)}%`, height: '100%', borderRadius: 3, backgroundColor: colors.accent, opacity: isProcessing ? 0.55 : 1 }} />
    </View>
    <Text accessibilityLiveRegion="polite" style={{ color: colors.secondaryText, fontSize: 13, fontWeight: '600' }}>{words}</Text>
  </View>;
}

type TermsRowProps = { accepted: boolean; expanded: boolean; error?: string; onToggleAccepted: () => void; onToggleExpanded: () => void; onOpenFullTerms: () => void };

/** "I agree" checkbox with the terms summary one tap away, instead of two full-width buttons. */
export function SellerTermsRow({ accepted, expanded, error, onToggleAccepted, onToggleExpanded, onOpenFullTerms }: TermsRowProps) {
  const { colors } = useAppTheme();
  return <View style={{ gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: error ? colors.destructive : colors.border, backgroundColor: colors.surface }}>
    <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel="Accept seller terms" accessibilityState={{ checked: accepted }} onPress={onToggleAccepted}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: accepted ? colors.accent : colors.mutedText, backgroundColor: accepted ? colors.accent : 'transparent' }}>
        {accepted ? <Icon name="check" size={16} color={colors.onAccent} /> : null}
      </View>
      <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>I agree to the seller terms</Text>
    </TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} onPress={onToggleExpanded} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 }}>
      <Text style={{ color: colors.accentText, fontWeight: '600', fontSize: 14 }}>{expanded ? 'Hide terms summary' : 'Read seller terms'}</Text>
      <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accentText} />
    </TouchableOpacity>
    {expanded ? <View style={{ gap: 8 }}>
      <Text style={{ color: colors.secondaryText, fontSize: 14, lineHeight: 20 }}>Provide accurate information and lawful listings. Your identity documents are private and are deleted 30 days after a final approval or rejection. Re-review requires fresh documents. Payments and payouts are not available in this release.</Text>
      <TouchableOpacity accessibilityRole="link" onPress={onOpenFullTerms} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Text style={{ color: colors.accentText, fontWeight: '600', fontSize: 14 }}>Open full terms</Text>
        <Icon name="external-link" size={14} color={colors.accentText} />
      </TouchableOpacity>
    </View> : null}
    {error ? <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text> : null}
  </View>;
}
