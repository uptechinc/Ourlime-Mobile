import { useCallback, useEffect, useState } from 'react';
import { Switch, Text, TextInput, View, type TextStyle } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import Icon from 'react-native-vector-icons/Feather';
import { toast } from 'sonner-native';
import AdminButton from '@/components/admin/AdminButton';
import AdminDialog from '@/components/admin/AdminDialog';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminScreen, { type AdminHeaderAction, type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminSection from '@/components/admin/AdminSection';
import { SecurityWorkspaceSkeleton } from '@/components/admin/AdminSkeletons';
import { AdminStatGrid } from '@/components/admin/AdminStatCard';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminState from '@/components/admin/AdminState';
import AdminStatusPill from '@/components/admin/AdminStatusPill';
import AdminToolbar from '@/components/admin/AdminToolbar';
import CountryPickerModal from '@/components/ui/CountryPickerModal';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type, type AdminToneName } from '@/lib/admin/adminTokens';
import { getCountryFlagEmoji } from '@/lib/constants/countries';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { evaluateSecurityAccess, type SecurityEvaluationResult } from '@/lib/security/securityAccessEvaluator';
import { adminSecurityService } from '@/lib/services/AdminSecurityService';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import type { IpRule, RateLimitConfig, RegionPolicyMode, SecurityAccessSettings, SecurityMonitoring, UserWhitelistEntry } from '@/lib/types/adminSecurity';

const REGIONS = [
  { code: 'TT', name: 'Trinidad & Tobago' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'BB', name: 'Barbados' },
  { code: 'GY', name: 'Guyana' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
];

const REGION_MODES: { mode: RegionPolicyMode; title: string; description: string }[] = [
  { mode: 'allow_all', title: 'Global access (allow all)', description: 'Access permitted from all countries.' },
  { mode: 'allow_selected_only', title: 'Allow selected only', description: 'Restrict platform access to the selected countries (e.g. Trinidad & Tobago).' },
  { mode: 'block_selected', title: 'Block selected countries', description: 'Allow all countries except those marked as blocked.' },
];

type SecurityTab = 'region' | 'ip' | 'whitelist' | 'ratelimit' | 'simulate' | 'monitoring';
type PendingSecurityRemoval = { kind: 'ip' | 'whitelist'; id: string; label: string };
type RateLimitField = Exclude<keyof RateLimitConfig, 'enabled'>;

/** Six tabs do not fit one segmented row on a phone, so they sit in two rows of three. */
const TAB_ROWS: { value: SecurityTab; label: string }[][] = [
  [
    { value: 'region', label: 'Region' },
    { value: 'ip', label: 'IP rules' },
    { value: 'whitelist', label: 'Whitelist' },
  ],
  [
    { value: 'ratelimit', label: 'Limits' },
    { value: 'simulate', label: 'Test rule' },
    { value: 'monitoring', label: 'Monitor' },
  ],
];

const RATE_LIMIT_FIELDS: { key: RateLimitField; label: string; fallback: number }[] = [
  { key: 'authPerMinute', label: 'Auth requests (per min / IP)', fallback: 15 },
  { key: 'postsPerMinute', label: 'Post creation (per min / user)', fallback: 30 },
  { key: 'commentsPerMinute', label: 'Comment creation (per min / user)', fallback: 45 },
  { key: 'generalPerMinute', label: 'General API (per min / IP)', fallback: 120 },
];

const getInputStyle = (colors: AppThemeColors): TextStyle => ({
  ...type.body,
  minHeight: ADMIN_MIN_TOUCH,
  paddingHorizontal: space.md,
  paddingVertical: 0,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.input,
  color: colors.text,
});

type ChoiceRowProps = { label: string; description?: string; selected: boolean; tone?: AdminToneName; disabled?: boolean; onPress: () => void };

/** 56pt single-choice row with a radio mark. */
function ChoiceRow({ label, description, selected, tone = 'positive', disabled = false, onPress }: ChoiceRowProps) {
  const { colors } = useAppTheme();
  const toneColors = getAdminTone(colors, tone);
  return (
    <AdminPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: selected, disabled }}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: selected ? toneColors.border : colors.border,
        backgroundColor: selected ? toneColors.soft : colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? toneColors.text : colors.mutedText} />
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: colors.text }]}>{label}</Text>
        {description ? <Text style={[type.meta, { color: colors.mutedText }]}>{description}</Text> : null}
      </View>
    </AdminPressable>
  );
}

type ChipProps = { label: string; tone: AdminToneName; icon: 'x' | 'plus' | 'check'; selected?: boolean; accessibilityLabel: string; onPress: () => void };

/** 36pt chip with hitSlop to 44pt; soft tone when selected. */
function Chip({ label, tone, icon, selected = true, accessibilityLabel, onPress }: ChipProps) {
  const { colors } = useAppTheme();
  const toneColors = getAdminTone(colors, selected ? tone : 'neutral');
  return (
    <AdminPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      hitSlop={{ top: space.xs, bottom: space.xs }}
      style={({ pressed }) => ({
        minHeight: 36,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingLeft: space.md,
        paddingRight: space.sm,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: toneColors.border,
        backgroundColor: selected ? toneColors.soft : colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text numberOfLines={1} style={[type.meta, { color: selected ? toneColors.text : colors.text }]}>
        {label}
      </Text>
      <Icon name={icon} size={14} color={selected ? toneColors.text : colors.icon} />
    </AdminPressable>
  );
}

export default function AdminSecurityWorkspace() {
  const { colors } = useAppTheme();
  const pending = getAdminTone(colors, 'pending');
  const [settings, setSettings] = useState<SecurityAccessSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<SecurityAccessSettings | null>(null);
  const [activeTab, setActiveTab] = useState<SecurityTab>('region');
  const [monitoring, setMonitoring] = useState<SecurityMonitoring | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringError, setMonitoringError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PendingSecurityRemoval | null>(null);
  const [countryPicker, setCountryPicker] = useState<'region' | 'simulate' | null>(null);
  const [ipDialogOpen, setIpDialogOpen] = useState(false);
  const [whitelistDialogOpen, setWhitelistDialogOpen] = useState(false);

  // Form states
  const [newIp, setNewIp] = useState('');
  const [newIpType, setNewIpType] = useState<'whitelist' | 'blocklist'>('whitelist');
  const [newIpLabel, setNewIpLabel] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserReason, setNewUserReason] = useState('');

  // Simulator states
  const [simIp, setSimIp] = useState('');
  const [simCountry, setSimCountry] = useState('TT');
  const [simResult, setSimResult] = useState<SecurityEvaluationResult | null>(null);

  const loadSettings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const data = await adminSecurityService.getSettings();
      setSettings(data);
      setSavedSettings(data);
    } catch (err: unknown) {
      console.error('[AdminSecurityWorkspace.loadSettings] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Could not load security settings';
      setLoadError(errorMessage);
      if (isRefresh) toast.error(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const loadMonitoring = useCallback(async () => {
    setMonitoringLoading(true);
    setMonitoringError(null);
    try {
      setMonitoring(await adminSecurityService.getMonitoring());
    } catch (monitoringFailure: unknown) {
      console.error('[AdminSecurityWorkspace.loadMonitoring] Error:', monitoringFailure instanceof Error ? monitoringFailure.message : monitoringFailure);
      setMonitoringError(monitoringFailure instanceof Error ? monitoringFailure.message : 'Could not load security monitoring');
    } finally {
      setMonitoringLoading(false);
    }
  }, []);

  /** Resolves true only when the settings were saved, so callers keep the admin's input on failure. */
  const handleSave = async (updated: SecurityAccessSettings): Promise<boolean> => {
    if (saving) return false;
    try {
      setSaving(true);
      void interactionFeedbackService.play('post');
      const saved = await adminSecurityService.updateSettings(updated);
      setSettings(saved);
      setSavedSettings(saved);
      void interactionFeedbackService.play('success');
      toast.success('Security and access settings updated.');
      return true;
    } catch (err: unknown) {
      console.error('[AdminSecurityWorkspace.handleSave] Error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
      void interactionFeedbackService.play('warning');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCountry = (code: string) => {
    if (!settings) return;
    const current = settings.regionPolicy.countries;
    const next = current.includes(code) ? current.filter((countryCode) => countryCode !== code) : [...current, code];
    setSettings({ ...settings, regionPolicy: { ...settings.regionPolicy, countries: next } });
  };

  const handleAddIpRule = async () => {
    if (!newIp.trim() || !settings) return;
    const newRule: IpRule = {
      id: Date.now().toString(),
      ip: newIp.trim(),
      type: newIpType,
      label: newIpLabel.trim() || undefined,
      createdAt: new Date().toISOString(),
      createdBy: 'Admin',
    };
    if (await handleSave({ ...settings, ipRules: [...settings.ipRules, newRule] })) {
      setNewIp('');
      setNewIpLabel('');
      setIpDialogOpen(false);
    }
  };

  const handleAddUserWhitelist = async () => {
    if ((!newUserId.trim() && !newUserEmail.trim()) || !settings) return;
    const newEntry: UserWhitelistEntry = {
      userId: newUserId.trim() || Date.now().toString(),
      email: newUserEmail.trim() || undefined,
      reason: newUserReason.trim() || 'Admin whitelist exception',
      addedAt: new Date().toISOString(),
      addedBy: 'Admin',
    };
    if (await handleSave({ ...settings, userWhitelist: [...settings.userWhitelist, newEntry] })) {
      setNewUserId('');
      setNewUserEmail('');
      setNewUserReason('');
      setWhitelistDialogOpen(false);
    }
  };

  // Removal is confirmed in a danger dialog that closes only once the save succeeds.
  const handleConfirmRemoval = async () => {
    if (!pendingRemoval || saving || !settings) return;
    const updated = pendingRemoval.kind === 'ip'
      ? { ...settings, ipRules: settings.ipRules.filter((rule) => rule.id !== pendingRemoval.id) }
      : { ...settings, userWhitelist: settings.userWhitelist.filter((entry) => entry.userId !== pendingRemoval.id) };
    if (await handleSave(updated)) setPendingRemoval(null);
  };

  const handleEvaluate = () => {
    if (!simIp.trim() || !settings) return;
    setSimResult(evaluateSecurityAccess(settings, { ip: simIp.trim(), countryCode: simCountry.trim() }));
  };

  const handleTabChange = (next: string) => {
    const tab = TAB_ROWS.flat().find((option) => option.value === next)?.value;
    if (!tab) return;
    setActiveTab(tab);
    if (tab === 'monitoring') void loadMonitoring();
  };

  const handleRefresh = async () => {
    if (activeTab === 'monitoring') {
      await loadMonitoring();
      return;
    }
    await loadSettings(true);
  };

  const regionDirty = Boolean(settings && savedSettings && JSON.stringify(settings.regionPolicy) !== JSON.stringify(savedSettings.regionPolicy));
  const rateDirty = Boolean(settings && savedSettings && JSON.stringify(settings.rateLimits) !== JSON.stringify(savedSettings.rateLimits));

  const primaryAction: AdminHeaderAction | undefined = !settings
    ? undefined
    : activeTab === 'region'
      ? { key: 'save-region', label: 'Save', icon: 'check', busy: saving, disabled: !regionDirty, onPress: () => void handleSave(settings) }
      : activeTab === 'ratelimit'
        ? { key: 'save-limits', label: 'Save', icon: 'check', busy: saving, disabled: !rateDirty, onPress: () => void handleSave(settings) }
        : activeTab === 'ip'
          ? { key: 'add-ip', label: 'Add rule', icon: 'plus', disabled: saving, onPress: () => setIpDialogOpen(true) }
          : activeTab === 'whitelist'
            ? { key: 'add-whitelist', label: 'Add', icon: 'user-plus', disabled: saving, onPress: () => setWhitelistDialogOpen(true) }
            : activeTab === 'simulate'
              ? { key: 'evaluate', label: 'Evaluate', icon: 'play', disabled: !simIp.trim(), onPress: handleEvaluate }
              : undefined;

  const screenState: AdminScreenState = loading
    ? { kind: 'loading' }
    : !settings
      ? { kind: 'error', title: 'Security settings unavailable', message: loadError || 'Security settings could not be loaded.' }
      : { kind: 'ready' };

  const unsavedBanner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: pending.border, backgroundColor: pending.soft }}>
      <Icon name="alert-circle" size={16} color={pending.text} />
      <Text style={[type.body, { flex: 1, color: pending.text }]}>Unsaved changes. Tap Save to apply them.</Text>
    </View>
  );

  const renderRegion = (current: SecurityAccessSettings) => {
    const isBlocklist = current.regionPolicy.mode === 'block_selected';
    const presets = REGIONS.filter((region) => !current.regionPolicy.countries.includes(region.code));
    return (
      <>
        {regionDirty ? unsavedBanner : null}
        <AdminSection title="Geographic enforcement policy">
          <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
            {REGION_MODES.map((option) => (
              <ChoiceRow
                key={option.mode}
                label={option.title}
                description={option.description}
                selected={current.regionPolicy.mode === option.mode}
                onPress={() => setSettings({ ...current, regionPolicy: { ...current.regionPolicy, mode: option.mode } })}
              />
            ))}
          </View>
        </AdminSection>

        {current.regionPolicy.mode !== 'allow_all' ? (
          <AdminSection
            title={isBlocklist ? 'Blocked countries' : 'Allowed countries'}
            description={`${current.regionPolicy.countries.length} selected`}
            action={{ label: 'Add country', onPress: () => setCountryPicker('region') }}
          >
            {current.regionPolicy.countries.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {current.regionPolicy.countries.map((code) => (
                  <Chip
                    key={code}
                    label={`${getCountryFlagEmoji(code)} ${code}`}
                    tone={isBlocklist ? 'danger' : 'positive'}
                    icon="x"
                    accessibilityLabel={`Remove ${code}`}
                    onPress={() => handleToggleCountry(code)}
                  />
                ))}
              </View>
            ) : (
              <Text style={[type.meta, { color: colors.mutedText }]}>No countries selected yet.</Text>
            )}
            {presets.length ? (
              <View style={{ gap: space.sm }}>
                <Text style={[type.label, { color: colors.mutedText }]}>Quick add</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {presets.map((region) => (
                    <Chip
                      key={region.code}
                      label={`${getCountryFlagEmoji(region.code)} ${region.name}`}
                      tone="neutral"
                      icon="plus"
                      selected={false}
                      accessibilityLabel={`Add ${region.name}`}
                      onPress={() => handleToggleCountry(region.code)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            <View style={{ gap: space.xs }}>
              <Text style={[type.label, { color: colors.mutedText }]}>Custom blocked notice</Text>
              <TextInput
                value={current.regionPolicy.blockedMessage || ''}
                onChangeText={(text) => setSettings({ ...current, regionPolicy: { ...current.regionPolicy, blockedMessage: text } })}
                accessibilityLabel="Custom blocked notice"
                placeholder="Access is currently restricted in your geographic region."
                placeholderTextColor={colors.mutedText}
                style={getInputStyle(colors)}
              />
            </View>
          </AdminSection>
        ) : null}
      </>
    );
  };

  const renderIpRules = (current: SecurityAccessSettings) => (
    <>
      <AdminSection title="Whitelist overrides region blocking" tone="positive">
        <Text style={[type.body, { color: colors.secondaryText }]}>
          Whitelisted IPs can connect to Ourlime even if their country is blocked. The blocklist denies all traffic unconditionally.
        </Text>
      </AdminSection>
      <Text style={[type.label, { color: colors.mutedText }]}>Active IP rules ({current.ipRules.length})</Text>
      {current.ipRules.length === 0 ? (
        <AdminState kind="empty" icon="lock" title="No custom IP rules added." action={{ key: 'add', label: 'Add rule', icon: 'plus', onPress: () => setIpDialogOpen(true) }} />
      ) : (
        <View style={{ gap: space.sm }}>
          {current.ipRules.map((rule) => (
            <AdminListRow
              key={rule.id}
              title={rule.ip}
              subtitle={rule.label}
              leading={{ kind: 'icon', name: rule.type === 'whitelist' ? 'unlock' : 'lock', tone: rule.type === 'whitelist' ? 'positive' : 'danger' }}
              status={{ label: rule.type === 'whitelist' ? 'Allow' : 'Deny', tone: rule.type === 'whitelist' ? 'positive' : 'danger' }}
              overflowActions={[
                { key: 'remove', label: 'Remove rule', icon: 'trash-2', tone: 'danger', disabled: saving, onPress: () => setPendingRemoval({ kind: 'ip', id: rule.id, label: rule.ip }) },
              ]}
            />
          ))}
        </View>
      )}
    </>
  );

  const renderWhitelist = (current: SecurityAccessSettings) => (
    <>
      <Text style={[type.body, { color: colors.secondaryText }]}>Whitelisted accounts can bypass all region and IP locks globally.</Text>
      <Text style={[type.label, { color: colors.mutedText }]}>Whitelisted accounts ({current.userWhitelist.length})</Text>
      {current.userWhitelist.length === 0 ? (
        <AdminState kind="empty" icon="star" title="No whitelisted accounts configured." action={{ key: 'add', label: 'Add account', icon: 'user-plus', onPress: () => setWhitelistDialogOpen(true) }} />
      ) : (
        <View style={{ gap: space.sm }}>
          {current.userWhitelist.map((entry) => {
            const label = entry.email || entry.userId;
            return (
              <AdminListRow
                key={entry.userId}
                title={label}
                subtitle={entry.reason ? `Reason: ${entry.reason}` : undefined}
                meta={entry.email ? entry.userId : undefined}
                leading={{ kind: 'avatar', name: label, userId: entry.userId }}
                overflowActions={[
                  { key: 'remove', label: 'Remove from whitelist', icon: 'trash-2', tone: 'danger', disabled: saving, onPress: () => setPendingRemoval({ kind: 'whitelist', id: entry.userId, label }) },
                ]}
              />
            );
          })}
        </View>
      )}
    </>
  );

  const renderRateLimits = (current: SecurityAccessSettings) => (
    <>
      {rateDirty ? unsavedBanner : null}
      <AdminSection title="API rate limiting" description="Prevent automated brute-force attacks and abuse.">
        <View style={{ minHeight: ADMIN_MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Text style={[type.bodyStrong, { flex: 1, color: colors.text }]}>Rate limiting enabled</Text>
          <Switch
            value={current.rateLimits.enabled}
            accessibilityLabel="Rate limiting enabled"
            onValueChange={(enabled) => setSettings({ ...current, rateLimits: { ...current.rateLimits, enabled } })}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>
        {RATE_LIMIT_FIELDS.map((field) => (
          <View key={field.key} style={{ gap: space.xs }}>
            <Text style={[type.label, { color: colors.mutedText }]}>{field.label}</Text>
            <TextInput
              value={String(current.rateLimits[field.key])}
              keyboardType="numeric"
              accessibilityLabel={field.label}
              onChangeText={(value) => setSettings({ ...current, rateLimits: { ...current.rateLimits, [field.key]: parseInt(value, 10) || field.fallback } })}
              style={getInputStyle(colors)}
            />
          </View>
        ))}
      </AdminSection>
    </>
  );

  const renderSimulator = () => {
    const resultTone = simResult ? getAdminTone(colors, simResult.allowed ? 'positive' : 'danger') : null;
    const isPreset = REGIONS.some((region) => region.code === simCountry);
    return (
      <>
        <AdminSection title="Access rule simulator" description="Test any IP and country against the active rules. Unsaved region edits are included.">
          <View style={{ gap: space.xs }}>
            <Text style={[type.label, { color: colors.mutedText }]}>Test IP address</Text>
            <TextInput
              value={simIp}
              onChangeText={setSimIp}
              onSubmitEditing={handleEvaluate}
              returnKeyType="go"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Test IP address"
              placeholder="e.g. 190.58.12.44"
              placeholderTextColor={colors.mutedText}
              style={getInputStyle(colors)}
            />
          </View>
          <View style={{ gap: space.sm }}>
            <Text style={[type.label, { color: colors.mutedText }]}>Test country</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {REGIONS.map((region) => (
                <Chip
                  key={region.code}
                  label={`${getCountryFlagEmoji(region.code)} ${region.name}`}
                  tone="positive"
                  icon="check"
                  selected={simCountry === region.code}
                  accessibilityLabel={`Test from ${region.name}`}
                  onPress={() => setSimCountry(region.code)}
                />
              ))}
              {!isPreset ? <Chip label={`${getCountryFlagEmoji(simCountry)} ${simCountry}`} tone="positive" icon="check" accessibilityLabel={`Test from ${simCountry}`} onPress={() => setCountryPicker('simulate')} /> : null}
            </View>
            <AdminButton label="Other country" icon="search" tone="neutral" emphasis="ghost" onPress={() => setCountryPicker('simulate')} style={{ alignSelf: 'flex-start' }} />
          </View>
          <AdminButton label="Evaluate rule" icon="play" tone="positive" emphasis="primary" fullWidth disabled={!simIp.trim()} onPress={handleEvaluate} />
        </AdminSection>

        {simResult && resultTone ? (
          <View style={{ gap: space.sm, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: resultTone.border, backgroundColor: resultTone.soft }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
              <Icon name={simResult.allowed ? 'check-circle' : 'x-circle'} size={18} color={resultTone.text} />
              <Text style={[type.section, { color: resultTone.text }]}>{simResult.allowed ? 'Access granted' : 'Access blocked'}</Text>
              {simResult.bypass ? <AdminStatusPill label="Whitelist override" tone="positive" /> : null}
            </View>
            <Text style={[type.body, { color: colors.text }]}>
              Matched rule: {simResult.ruleMatched}
              {simResult.matchedRuleDetail ? ` — ${simResult.matchedRuleDetail}` : ''}
            </Text>
            {simResult.reason ? <Text style={[type.meta, { color: colors.secondaryText }]}>Reason: {simResult.reason}</Text> : null}
          </View>
        ) : null}
      </>
    );
  };

  const renderMonitoring = () => {
    if (monitoringError && !monitoring) {
      return <AdminState kind="error" title="Monitoring unavailable" message={monitoringError} onRetry={() => void loadMonitoring()} retrying={monitoringLoading} />;
    }
    if (monitoringLoading && !monitoring) return <AdminState kind="loading" variant="list" rows={4} />;
    return (
      <>
        {monitoringError ? <AdminState kind="inlineError" message={monitoringError} onRetry={() => void loadMonitoring()} retrying={monitoringLoading} /> : null}
        <AdminStatGrid>
          <AdminStatCard
            label="Active rate buckets"
            value={monitoring?.activeRateBuckets ?? '—'}
            icon="activity"
            hint={monitoring && monitoring.activeRateBuckets === null ? 'Bucket counts are only visible on ourlime.com.' : undefined}
            loading={monitoringLoading && !monitoring}
          />
        </AdminStatGrid>
        <Text style={[type.label, { color: colors.mutedText }]}>Recent security audit</Text>
        {!monitoring || monitoring.recentAudit.length === 0 ? (
          <AdminState kind="empty" icon="shield" title="No recent security audit events." />
        ) : (
          <View style={{ gap: space.sm }}>
            {monitoring.recentAudit.map((entry) => (
              <AdminListRow
                key={entry.id}
                title={entry.action.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase())}
                subtitle={`Admin: ${entry.adminId || 'system'}${entry.targetUserId ? ` · Target: ${entry.targetUserId}` : ''}`}
                meta={entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Pending timestamp'}
                leading={{ kind: 'icon', name: 'shield' }}
              />
            ))}
          </View>
        )}
      </>
    );
  };

  const renderTab = (current: SecurityAccessSettings) => {
    switch (activeTab) {
      case 'region':
        return renderRegion(current);
      case 'ip':
        return renderIpRules(current);
      case 'whitelist':
        return renderWhitelist(current);
      case 'ratelimit':
        return renderRateLimits(current);
      case 'simulate':
        return renderSimulator();
      case 'monitoring':
      default:
        return renderMonitoring();
    }
  };

  return (
    <>
      <AdminScreen
        title="Security"
        subtitle="Region, IP, whitelist and rate-limit controls"
        state={screenState}
        onRefresh={handleRefresh}
        refreshing={refreshing || (activeTab === 'monitoring' && monitoringLoading && Boolean(monitoring))}
        primaryAction={primaryAction}
        keyboardAware
        skeleton={<SecurityWorkspaceSkeleton />}
        toolbar={
          <View style={{ gap: space.sm }}>
            {TAB_ROWS.map((row) => (
              <AdminToolbar key={row[0].value} segments={{ value: activeTab, options: row, onChange: handleTabChange }} />
            ))}
          </View>
        }
      >
        {settings ? <View style={{ gap: space.md }}>{renderTab(settings)}</View> : null}
      </AdminScreen>

      {settings ? (
        <CountryPickerModal
          visible={countryPicker !== null}
          onClose={() => setCountryPicker(null)}
          title={countryPicker === 'simulate' ? 'Test country' : undefined}
          selectedCountries={countryPicker === 'simulate' ? [simCountry] : settings.regionPolicy.countries}
          onSelectCountry={(selectedCode) => {
            const normalized = selectedCode.toUpperCase();
            if (countryPicker === 'simulate') {
              setSimCountry(normalized);
              setCountryPicker(null);
              return;
            }
            if (!settings.regionPolicy.countries.includes(normalized)) {
              setSettings({ ...settings, regionPolicy: { ...settings.regionPolicy, countries: [...settings.regionPolicy.countries, normalized] } });
            }
          }}
        />
      ) : null}

      <AdminDialog
        visible={ipDialogOpen}
        title="Add IP access rule"
        description="The rule applies to everyone straight away."
        icon="lock"
        confirmLabel="Add rule"
        confirmDisabled={!newIp.trim()}
        busy={saving}
        onConfirm={() => void handleAddIpRule()}
        onClose={() => {
          if (!saving) setIpDialogOpen(false);
        }}
      >
        <View style={{ gap: space.md }}>
          <View style={{ gap: space.xs }}>
            <Text style={[type.label, { color: colors.mutedText }]}>IP address</Text>
            <TextInput
              value={newIp}
              onChangeText={setNewIp}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
              accessibilityLabel="IP address"
              placeholder="e.g. 190.58.12.44"
              placeholderTextColor={colors.mutedText}
              style={getInputStyle(colors)}
            />
          </View>
          <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
            <ChoiceRow label="Whitelist (allow)" description="Overrides region blocking" selected={newIpType === 'whitelist'} disabled={saving} onPress={() => setNewIpType('whitelist')} />
            <ChoiceRow label="Blocklist (deny)" description="Denies all traffic from this IP" tone="danger" selected={newIpType === 'blocklist'} disabled={saving} onPress={() => setNewIpType('blocklist')} />
          </View>
          <View style={{ gap: space.xs }}>
            <Text style={[type.label, { color: colors.mutedText }]}>Label or note (optional)</Text>
            <TextInput value={newIpLabel} onChangeText={setNewIpLabel} editable={!saving} accessibilityLabel="Label or note" placeholderTextColor={colors.mutedText} style={getInputStyle(colors)} />
          </View>
        </View>
      </AdminDialog>

      <AdminDialog
        visible={whitelistDialogOpen}
        title="Add whitelist bypass"
        description="The account bypasses all region and IP locks straight away."
        icon="star"
        confirmLabel="Add to whitelist"
        confirmDisabled={!newUserId.trim() && !newUserEmail.trim()}
        busy={saving}
        onConfirm={() => void handleAddUserWhitelist()}
        onClose={() => {
          if (!saving) setWhitelistDialogOpen(false);
        }}
      >
        <View style={{ gap: space.md }}>
          <View style={{ gap: space.xs }}>
            <Text style={[type.label, { color: colors.mutedText }]}>User ID (UID)</Text>
            <TextInput value={newUserId} onChangeText={setNewUserId} autoCapitalize="none" autoCorrect={false} editable={!saving} accessibilityLabel="User ID" placeholderTextColor={colors.mutedText} style={getInputStyle(colors)} />
          </View>
          <View style={{ gap: space.xs }}>
            <Text style={[type.label, { color: colors.mutedText }]}>User email</Text>
            <TextInput
              value={newUserEmail}
              onChangeText={setNewUserEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!saving}
              accessibilityLabel="User email"
              placeholderTextColor={colors.mutedText}
              style={getInputStyle(colors)}
            />
          </View>
          <View style={{ gap: space.xs }}>
            <Text style={[type.label, { color: colors.mutedText }]}>Reason for exception</Text>
            <TextInput
              value={newUserReason}
              onChangeText={setNewUserReason}
              editable={!saving}
              accessibilityLabel="Reason for exception"
              placeholder="e.g. Remote admin"
              placeholderTextColor={colors.mutedText}
              style={getInputStyle(colors)}
            />
          </View>
        </View>
      </AdminDialog>

      <AdminDialog
        visible={Boolean(pendingRemoval)}
        title={pendingRemoval?.kind === 'ip' ? 'Remove this IP rule?' : 'Remove this whitelist entry?'}
        description={pendingRemoval
          ? pendingRemoval.kind === 'ip'
            ? `${pendingRemoval.label} will no longer be allowed or blocked by this rule. This applies to everyone straight away.`
            : `${pendingRemoval.label} will lose their region and IP bypass straight away.`
          : undefined}
        confirmLabel="Remove"
        tone="danger"
        icon="trash-2"
        busy={saving}
        onConfirm={() => void handleConfirmRemoval()}
        onClose={() => {
          if (!saving) setPendingRemoval(null);
        }}
      />
    </>
  );
}
