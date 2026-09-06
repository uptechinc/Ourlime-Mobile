import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CountryPicker, { type Country } from 'react-native-country-picker-modal';
import { adminSecurityService } from '@/lib/services/AdminSecurityService';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import CustomModal from '@/components/ui/CustomModal';
import {
  evaluateSecurityAccess,
  type SecurityEvaluationResult,
} from '@/lib/security/securityAccessEvaluator';
import type {
  SecurityAccessSettings,
  RegionPolicyMode,
  IpRule,
  UserWhitelistEntry,
} from '@/lib/types/adminSecurity';

const REGIONS = [
  { code: 'TT', name: 'Trinidad & Tobago 🇹🇹' },
  { code: 'JM', name: 'Jamaica 🇯🇲' },
  { code: 'BB', name: 'Barbados 🇧🇧' },
  { code: 'GY', name: 'Guyana 🇬🇾' },
  { code: 'LC', name: 'Saint Lucia 🇱🇨' },
  { code: 'US', name: 'United States 🇺🇸' },
  { code: 'CA', name: 'Canada 🇨🇦' },
  { code: 'GB', name: 'United Kingdom 🇬🇧' },
];

export default function AdminSecurityWorkspace() {
  const { colors, isDark } = useAppTheme();
  const [settings, setSettings] = useState<SecurityAccessSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'region' | 'ip' | 'whitelist' | 'ratelimit' | 'simulate'>('region');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isCountryPickerVisible, setIsCountryPickerVisible] = useState(false);

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


  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminSecurityService.getSettings();
      setSettings(data);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Could not load security settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async (updated: Partial<SecurityAccessSettings>) => {
    try {
      setSaving(true);
      void interactionFeedbackService.play('post');
      const saved = await adminSecurityService.updateSettings(updated);
      setSettings(saved);
      void interactionFeedbackService.play('success');
      setMessage('Security and access settings updated successfully!');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to save settings');
      void interactionFeedbackService.play('warning');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCountry = (code: string) => {
    if (!settings) return;
    const current = settings.regionPolicy.countries;
    const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    setSettings({
      ...settings,
      regionPolicy: { ...settings.regionPolicy, countries: next },
    });
  };

  const handleAddIpRule = async () => {
    if (!newIp.trim() || !settings) return;
    try {
      setSaving(true);
      const newRule: IpRule = {
        id: Date.now().toString(),
        ip: newIp.trim(),
        type: newIpType,
        label: newIpLabel.trim() || undefined,
        createdAt: new Date().toISOString(),
        createdBy: 'Admin',
      };
      const updated = { ...settings, ipRules: [...settings.ipRules, newRule] };
      await handleSave(updated);
      setNewIp('');
      setNewIpLabel('');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to add IP rule');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveIpRule = async (id: string) => {
    if (!settings) return;
    const updated = {
      ...settings,
      ipRules: settings.ipRules.filter((r) => r.id !== id),
    };
    await handleSave(updated);
  };

  const handleAddUserWhitelist = async () => {
    if ((!newUserId.trim() && !newUserEmail.trim()) || !settings) return;
    try {
      setSaving(true);
      const newEntry: UserWhitelistEntry = {
        userId: newUserId.trim() || Date.now().toString(),
        email: newUserEmail.trim() || undefined,
        reason: newUserReason.trim() || 'Admin whitelist exception',
        addedAt: new Date().toISOString(),
        addedBy: 'Admin',
      };
      const updated = { ...settings, userWhitelist: [...settings.userWhitelist, newEntry] };
      await handleSave(updated);
      setNewUserId('');
      setNewUserEmail('');
      setNewUserReason('');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to add whitelist user');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUserWhitelist = async (userId: string) => {
    if (!settings) return;
    const updated = {
      ...settings,
      userWhitelist: settings.userWhitelist.filter((u) => u.userId !== userId),
    };
    await handleSave(updated);
  };

  if (loading) {
    return (
      <View style={{ paddingVertical: 50, alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ marginTop: 8, color: colors.mutedText, fontSize: 12 }}>
          Loading security controls…
        </Text>
      </View>
    );
  }

  if (!settings) return null;

  return (
    <View className="space-y-4">
      {/* Sub-tab navigation */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
        {(
          [
            { id: 'region' as const, label: '🌍 Region Blocking' },
            { id: 'ip' as const, label: '🔒 IP Rules' },
            { id: 'whitelist' as const, label: '⭐ Whitelist Bypass' },
            { id: 'ratelimit' as const, label: '⚡ Rate Limits' },
            { id: 'simulate' as const, label: '🧪 Test Rule' },
          ]
        ).map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={{
              marginRight: 8,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 8,
              backgroundColor: activeTab === tab.id ? colors.accent : colors.control,
            }}
          >
            <Text
              style={{
                color: activeTab === tab.id ? colors.onAccent : colors.secondaryText,
                fontSize: 12,
                fontWeight: '800',
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 1. Region Blocking */}
      {activeTab === 'region' && (
        <View className="space-y-4">
          <View
            style={{
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14, marginBottom: 10 }}>
              Geographic Enforcement Policy
            </Text>

            {(
              [
                { mode: 'allow_all' as RegionPolicyMode, title: 'Global Access (Allow All)', desc: 'Access permitted from all countries.' },
                { mode: 'allow_selected_only' as RegionPolicyMode, title: 'Allow Selected Only', desc: 'Strictly restrict platform access to selected countries (e.g. Trinidad & Tobago).' },
                { mode: 'block_selected' as RegionPolicyMode, title: 'Block Selected Countries', desc: 'Allow all countries except those marked as blocked.' },
              ]
            ).map((opt) => {
              const isSelected = settings.regionPolicy.mode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  onPress={() =>
                    setSettings({
                      ...settings,
                      regionPolicy: { ...settings.regionPolicy, mode: opt.mode },
                    })
                  }
                  style={{
                    backgroundColor: isSelected
                      ? (isDark ? '#064e3b' : '#ecfdf5')
                      : (isDark ? '#18181b' : '#fafafa'),
                    borderColor: isSelected ? '#10b981' : colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isSelected ? '#10b981' : colors.mutedText,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                      }}
                    >
                      {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                        {opt.title}
                      </Text>
                      <Text style={{ color: colors.mutedText, fontSize: 11, marginTop: 2 }}>
                        {opt.desc}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {settings.regionPolicy.mode !== 'allow_all' && (
              <View style={{ marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                {/* Custom Blocked Notice */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                    CUSTOM BLOCKED NOTICE
                  </Text>
                  <TextInput
                    value={settings.regionPolicy.blockedMessage || ''}
                    onChangeText={(text) =>
                      setSettings({
                        ...settings,
                        regionPolicy: { ...settings.regionPolicy, blockedMessage: text },
                      })
                    }
                    placeholder="Access is currently restricted in your geographic region."
                    placeholderTextColor={colors.mutedText}
                    style={{
                      backgroundColor: colors.input,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 10,
                      color: colors.text,
                      fontSize: 12,
                    }}
                  />
                </View>

                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' }}>
                  Select Countries for {settings.regionPolicy.mode === 'allow_selected_only' ? 'Allowlist' : 'Blocklist'}:
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {REGIONS.map((reg) => {
                    const isSelected = settings.regionPolicy.countries.includes(reg.code);
                    return (
                      <TouchableOpacity
                        key={reg.code}
                        onPress={() => handleToggleCountry(reg.code)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 12,
                          backgroundColor: isSelected ? '#10b981' : colors.control,
                          marginBottom: 6,
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? '#ffffff' : colors.text,
                            fontWeight: '700',
                            fontSize: 12,
                          }}
                        >
                          {reg.name} {isSelected ? '✓' : '+'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    onPress={() => setIsCountryPickerVisible(true)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 12,
                      backgroundColor: colors.control,
                      borderWidth: 1,
                      borderColor: '#10b981',
                      marginBottom: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Ionicons name="search-outline" size={13} color="#10b981" />
                    <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 12 }}>
                      + Pick Any Country…
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* CountryPicker Modal Component */}
                <CountryPicker
                  countryCode="TT"
                  visible={isCountryPickerVisible}
                  onClose={() => setIsCountryPickerVisible(false)}
                  withFilter
                  withFlag
                  withAlphaFilter
                  onSelect={(country: Country) => {
                    setIsCountryPickerVisible(false);
                    if (country.cca2) {
                      const code = country.cca2.toUpperCase();
                      if (!settings.regionPolicy.countries.includes(code)) {
                        setSettings({
                          ...settings,
                          regionPolicy: {
                            ...settings.regionPolicy,
                            countries: [...settings.regionPolicy.countries, code],
                          },
                        });
                      }
                    }
                  }}
                />

                {/* Active Selected Countries List */}
                <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                  ACTIVE REGIONS ({settings.regionPolicy.countries.length})
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {settings.regionPolicy.countries.map((code) => (
                    <View
                      key={code}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 10,
                        backgroundColor:
                          settings.regionPolicy.mode === 'block_selected'
                            ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2')
                            : (isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5'),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: settings.regionPolicy.mode === 'block_selected' ? '#ef4444' : '#10b981',
                        }}
                      >
                        {code}
                      </Text>
                      <TouchableOpacity onPress={() => handleToggleCountry(code)}>
                        <Ionicons
                          name="close-circle"
                          size={14}
                          color={settings.regionPolicy.mode === 'block_selected' ? '#ef4444' : '#10b981'}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => void handleSave(settings)}
              disabled={saving}
              style={{
                marginTop: 14,
                backgroundColor: '#10b981',
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
              }}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>
                  Save Region Settings
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 2. IP Rules */}
      {activeTab === 'ip' && (
        <View className="space-y-4">
          <View
            style={{
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14, marginBottom: 8 }}>
              Add IP Access Rule
            </Text>

            {/* Whitelist Override Explanatory Card */}
            <View
              style={{
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                borderColor: '#10b981',
                borderWidth: 1,
                borderRadius: 14,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 11 }}>
                ⭐ WHITELIST OVERRIDES REGION BLOCKING
              </Text>
              <Text style={{ color: colors.mutedText, fontSize: 11, marginTop: 2 }}>
                Whitelisted IPs allow users to connect to Ourlime even if their country is blocked. Blocklist denies all traffic unconditionally.
              </Text>
            </View>

            <TextInput
              value={newIp}
              onChangeText={setNewIp}
              placeholder="IP Address (e.g. 190.58.12.44)"
              placeholderTextColor={colors.mutedText}
              style={{
                backgroundColor: colors.input,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 10,
                color: colors.text,
                fontSize: 12,
                marginBottom: 8,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => setNewIpType('whitelist')}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: newIpType === 'whitelist' ? '#10b981' : colors.control,
                }}
              >
                <Text style={{ color: newIpType === 'whitelist' ? '#ffffff' : colors.text, fontWeight: '700', fontSize: 11 }}>
                  Whitelist (Allow)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setNewIpType('blocklist')}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: newIpType === 'blocklist' ? '#ef4444' : colors.control,
                }}
              >
                <Text style={{ color: newIpType === 'blocklist' ? '#ffffff' : colors.text, fontWeight: '700', fontSize: 11 }}>
                  Blocklist (Deny)
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              value={newIpLabel}
              onChangeText={setNewIpLabel}
              placeholder="Label / Note (optional)"
              placeholderTextColor={colors.mutedText}
              style={{
                backgroundColor: colors.input,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 10,
                color: colors.text,
                fontSize: 12,
                marginBottom: 10,
              }}
            />

            <TouchableOpacity
              onPress={() => void handleAddIpRule()}
              disabled={saving}
              style={{
                backgroundColor: colors.accent,
                paddingVertical: 11,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.onAccent, fontWeight: '800', fontSize: 12 }}>
                Add Rule
              </Text>
            </TouchableOpacity>
          </View>

          {/* IP Rules List */}
          <View
            style={{
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14, marginBottom: 8 }}>
              Active IP Rules ({settings.ipRules.length})
            </Text>
            {settings.ipRules.length === 0 ? (
              <Text style={{ color: colors.mutedText, fontSize: 12 }}>No custom IP rules added.</Text>
            ) : (
              settings.ipRules.map((rule) => (
                <View
                  key={rule.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text
                        style={{
                          color: rule.type === 'whitelist' ? '#10b981' : '#ef4444',
                          fontWeight: '800',
                          fontSize: 10,
                          textTransform: 'uppercase',
                          marginRight: 6,
                        }}
                      >
                        [{rule.type}]
                      </Text>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                        {rule.ip}
                      </Text>
                    </View>
                    {rule.label && (
                      <Text style={{ color: colors.mutedText, fontSize: 11, marginTop: 1 }}>
                        {rule.label}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => void handleRemoveIpRule(rule.id)}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* 3. Account Whitelist */}
      {activeTab === 'whitelist' && (
        <View className="space-y-4">
          <View
            style={{
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14, marginBottom: 4 }}>
              Account Whitelist Bypass
            </Text>
            <Text style={{ color: colors.mutedText, fontSize: 11, marginBottom: 10 }}>
              Whitelisted accounts can bypass all region and IP locks globally.
            </Text>

            <TextInput
              value={newUserId}
              onChangeText={setNewUserId}
              placeholder="User ID (UID)"
              placeholderTextColor={colors.mutedText}
              style={{
                backgroundColor: colors.input,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 10,
                color: colors.text,
                fontSize: 12,
                marginBottom: 8,
              }}
            />

            <TextInput
              value={newUserEmail}
              onChangeText={setNewUserEmail}
              placeholder="User Email"
              placeholderTextColor={colors.mutedText}
              style={{
                backgroundColor: colors.input,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 10,
                color: colors.text,
                fontSize: 12,
                marginBottom: 8,
              }}
            />

            <TextInput
              value={newUserReason}
              onChangeText={setNewUserReason}
              placeholder="Reason for exception (e.g. Remote Admin)"
              placeholderTextColor={colors.mutedText}
              style={{
                backgroundColor: colors.input,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 10,
                color: colors.text,
                fontSize: 12,
                marginBottom: 10,
              }}
            />

            <TouchableOpacity
              onPress={() => void handleAddUserWhitelist()}
              disabled={saving}
              style={{
                backgroundColor: '#10b981',
                paddingVertical: 11,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }}>
                Add Whitelist Bypass
              </Text>
            </TouchableOpacity>
          </View>

          {/* List */}
          <View
            style={{
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14, marginBottom: 8 }}>
              Whitelisted Accounts ({settings.userWhitelist.length})
            </Text>
            {settings.userWhitelist.length === 0 ? (
              <Text style={{ color: colors.mutedText, fontSize: 12 }}>No whitelisted accounts configured.</Text>
            ) : (
              settings.userWhitelist.map((entry) => (
                <View
                  key={entry.userId}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                      {entry.email || entry.userId}
                    </Text>
                    <Text style={{ color: colors.mutedText, fontSize: 11, marginTop: 1 }}>
                      Reason: {entry.reason}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => void handleRemoveUserWhitelist(entry.userId)}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* 4. Rate Limiting */}
      {activeTab === 'ratelimit' && (
        <View
          style={{
            backgroundColor: colors.elevated,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 18,
            padding: 16,
          }}
          className="space-y-4"
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
                API Rate Limiting Engine
              </Text>
              <Text style={{ color: colors.mutedText, fontSize: 11, marginTop: 2 }}>
                Prevent automated brute-force attacks and abuse.
              </Text>
            </View>
            <Switch
              value={settings.rateLimits.enabled}
              onValueChange={(val) =>
                setSettings({
                  ...settings,
                  rateLimits: { ...settings.rateLimits, enabled: val },
                })
              }
              trackColor={{ false: '#71717a', true: '#10b981' }}
            />
          </View>

          <View style={{ gap: 12, marginTop: 10 }}>
            <View>
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                Auth Requests (per min / IP)
              </Text>
              <TextInput
                value={String(settings.rateLimits.authPerMinute)}
                keyboardType="numeric"
                onChangeText={(val) =>
                  setSettings({
                    ...settings,
                    rateLimits: { ...settings.rateLimits, authPerMinute: parseInt(val) || 15 },
                  })
                }
                style={{
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  color: colors.text,
                  fontSize: 12,
                }}
              />
            </View>

            <View>
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                Post Creation (per min / User)
              </Text>
              <TextInput
                value={String(settings.rateLimits.postsPerMinute)}
                keyboardType="numeric"
                onChangeText={(val) =>
                  setSettings({
                    ...settings,
                    rateLimits: { ...settings.rateLimits, postsPerMinute: parseInt(val) || 30 },
                  })
                }
                style={{
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  color: colors.text,
                  fontSize: 12,
                }}
              />
            </View>

            <View>
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                Comment Creation (per min / User)
              </Text>
              <TextInput
                value={String(settings.rateLimits.commentsPerMinute)}
                keyboardType="numeric"
                onChangeText={(val) =>
                  setSettings({
                    ...settings,
                    rateLimits: { ...settings.rateLimits, commentsPerMinute: parseInt(val) || 45 },
                  })
                }
                style={{
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  color: colors.text,
                  fontSize: 12,
                }}
              />
            </View>

            <TouchableOpacity
              onPress={() => void handleSave(settings)}
              disabled={saving}
              style={{
                marginTop: 10,
                backgroundColor: '#10b981',
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
              }}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>
                  Save Rate Limit Configuration
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 5. Access Rule Simulator */}
      {activeTab === 'simulate' && (
        <View className="space-y-4">
          <View
            style={{
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14, marginBottom: 4 }}>
              Access Rule Simulator
            </Text>
            <Text style={{ color: colors.mutedText, fontSize: 11, marginBottom: 12 }}>
              Test any IP and Country to see if access will be granted or blocked based on active rules.
            </Text>

            <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
              TEST IP ADDRESS
            </Text>
            <TextInput
              value={simIp}
              onChangeText={setSimIp}
              placeholder="e.g. 190.58.12.44"
              placeholderTextColor={colors.mutedText}
              style={{
                backgroundColor: colors.input,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 10,
                color: colors.text,
                fontSize: 12,
                marginBottom: 10,
              }}
            />

            <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
              TEST COUNTRY CODE
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {REGIONS.map((reg) => {
                const isSelected = simCountry === reg.code;
                return (
                  <TouchableOpacity
                    key={reg.code}
                    onPress={() => setSimCountry(reg.code)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: isSelected ? colors.accent : colors.control,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? colors.onAccent : colors.text,
                        fontWeight: '700',
                        fontSize: 11,
                      }}
                    >
                      {reg.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => {
                if (!simIp.trim() || !settings) return;
                const result = evaluateSecurityAccess(settings, {
                  ip: simIp.trim(),
                  countryCode: simCountry.trim(),
                });
                setSimResult(result);
              }}
              style={{
                backgroundColor: colors.accent,
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.onAccent, fontWeight: '800', fontSize: 13 }}>
                Evaluate Rule
              </Text>
            </TouchableOpacity>

            {simResult && (
              <View
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  backgroundColor: simResult.allowed
                    ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                    : (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2'),
                  borderColor: simResult.allowed ? '#10b981' : '#ef4444',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons
                    name={simResult.allowed ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={simResult.allowed ? '#10b981' : '#ef4444'}
                  />
                  <Text
                    style={{
                      fontWeight: '800',
                      fontSize: 13,
                      color: simResult.allowed ? '#10b981' : '#ef4444',
                    }}
                  >
                    {simResult.allowed ? 'ACCESS GRANTED' : 'ACCESS BLOCKED'}
                  </Text>
                  {simResult.bypass && (
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: '#10b981',
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#d1fae5',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      WHITELIST OVERRIDE
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>
                  Matched Rule: {simResult.ruleMatched}
                  {simResult.matchedRuleDetail ? ` — ${simResult.matchedRuleDetail}` : ''}
                </Text>
                {simResult.reason && (
                  <Text style={{ fontSize: 11, color: colors.mutedText, marginTop: 2 }}>
                    Reason: {simResult.reason}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      <CustomModal
        visible={Boolean(message)}
        title="Security & Access Controls"
        message={message ?? ''}
        type="info"
        onClose={() => setMessage(null)}
      />
    </View>
  );
}